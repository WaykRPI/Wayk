import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
};

export default function Home() {
  const { user, signOut } = useAuth();
  const { location, errorMsg } = useLocationContext();
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [intersections, setIntersections] = useState<any[]>([]); // State to hold intersection nodes

  useEffect(() => {
    if (location) {
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

      setCurrentLocation(newLocation);
      setSelectedLocation(newLocation);

      // Fetch intersections when location is available
      fetchIntersections(newLocation.latitude, newLocation.longitude);
    }
  }, [location]);

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

    // Calculate distance for each intersection and sort by proximity
    const sortedIntersections = data.elements
      .map((intersection) => ({
        ...intersection,
        distance: calculateDistance(latitude, longitude, intersection.lat, intersection.lon),
      }))
      .sort((a, b) => a.distance - b.distance); // Sort intersections by distance

    setIntersections(sortedIntersections); // Set sorted intersections
  };

  const handleLocationSelect = async (event: any) => {
    const coords = event.nativeEvent.coordinate;
    setSelectedLocation(coords);
    
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
          customMapStyle={mapStyle} // Custom map style
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
              description="Tap to confirm this location"
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/0ea5e9/marker.png' }} 
                style={styles.marker} 
              /> {/* Custom marker */}
            </Marker>
          )}
          {/* Render intersection markers */}
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
              /> {/* Custom marker for intersections */}
            </Marker>
          ))}
        </MapView>
      </View>

      {/* User Info Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
        
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* Selected Location Panel */}
      {selectedLocation && (
        <View style={styles.coordinatesContainer}>
          <Text style={styles.coordinates}>
            Selected: {selectedLocation.latitude.toFixed(4)}, 
            {selectedLocation.longitude.toFixed(4)}
          </Text>
          <Pressable 
            style={styles.confirmButton}
            onPress={() => {
              // Handle location confirmation
              setSelectedLocation(null);
            }}
          >
            <Text style={styles.buttonText}>Confirm Location</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Sample custom map style
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
    overflow: 'hidden', // To round the corners of the map
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