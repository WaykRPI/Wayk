import { View, Text, Pressable, StyleSheet, Image, TextInput } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';

export default function Home() {
  const { user, signOut } = useAuth();
  const { location, errorMsg } = useLocationContext();
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 42.859769, 
    longitude: -74.000300,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [intersections, setIntersections] = useState<any[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{
    latitude: number;
    longitude: number;
  }>>([]);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');

  useEffect(() => {
    if (TEST_MODE) {
      // Set up test scenario
      const testDestination = {
        latitude: 37.7935,  // Fisherman's Wharf
        longitude: -122.4399
      };
      
      setSelectedLocation(testDestination);
      
      // Simulate a fixed current location
      const testCurrentLocation = {
        coords: {
          latitude: 37.7749,  // Downtown SF
          longitude: -122.4194
        }
      };
      
      // Use test location instead of actual location
      setCurrentLocation({
        latitude: testCurrentLocation.coords.latitude,
        longitude: testCurrentLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      
      // Fetch route using test locations
      fetchRoute(
        { 
          latitude: testCurrentLocation.coords.latitude, 
          longitude: testCurrentLocation.coords.longitude 
        },
        testDestination
      );
    } else if (location) {
      // Normal location handling
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      
      if (selectedLocation) {
        fetchRoute(
          { latitude: location.coords.latitude, longitude: location.coords.longitude },
          selectedLocation
        );
      }
    }
  }, [location, TEST_MODE]);

  const fetchIntersections = async (latitude: number, longitude: number) => {
    const query = `
      [out:json];
      (
        node["highway"="traffic_signals"](around:1000, ${latitude}, ${longitude});
        node["highway"="crossing"](around:1000, ${latitude}, ${longitude});
      );
      out body;
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    setIntersections(data.elements);
  };

  const fetchRoute = async (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        // Convert coordinates from [longitude, latitude] to {latitude, longitude}
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        setRouteCoordinates(coordinates);

        // Set distance and duration
        const distanceInKm = (data.routes[0].distance / 1000).toFixed(1);
        const durationInMinutes = Math.round(data.routes[0].duration / 60);
        setDistance(`${distanceInKm} km`);
        setDuration(`${durationInMinutes} min`);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const handleLocationSelect = async (event: any) => {
    const coords = event.nativeEvent.coordinate;
    setSelectedLocation(coords);
    
    if (location) {
      fetchRoute(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        coords
      );
    }
    
    try {
      const { error } = await supabase
        .from('locations')
        .insert({
          user_id: user?.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={currentLocation}
          showsUserLocation
          showsMyLocationButton
          showsCompass
          onPress={handleLocationSelect}
          customMapStyle={mapStyle}
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Destination"
              description="Your destination"
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/0ea5e9/marker.png' }} 
                style={styles.marker} 
              />
            </Marker>
          )}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#0ea5e9"
              strokeWidth={3}
            />
          )}
          {intersections.map((intersection) => (
            <Marker
              key={intersection.id}
              coordinate={{
                latitude: intersection.lat,
                longitude: intersection.lon,
              }}
              title="Intersection"
              description="Traffic signal or crossing"
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/ffcc00/marker.png' }} 
                style={styles.marker} 
              />
            </Marker>
          ))}
        </MapView>
      </View>
      {selectedLocation && (
        <View style={styles.coordinatesContainer}>
          <Text style={styles.coordinates}>
            Destination: {selectedLocation.latitude.toFixed(4)}, 
            {selectedLocation.longitude.toFixed(4)}
          </Text>
          {distance && duration && (
            <Text style={styles.routeInfo}>
              Distance: {distance} • Duration: {duration}
            </Text>
          )}
          <Pressable 
            style={styles.confirmButton}
            onPress={() => {
              setSelectedLocation(null);
              setRouteCoordinates([]);
              setDistance('');
              setDuration('');
            }}
          >
            <Text style={styles.buttonText}>Clear Route</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Custom map style for dark theme
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  error: {
    color: '#ef4444',
    marginBottom: 10,
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    maxWidth: 200,
  },
  coordinatesContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  coordinates: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  routeInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#0ea5e9',
    padding: 15,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  marker: {
    width: 30,
    height: 30,
  },
});