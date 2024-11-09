import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker } from 'react-native-maps';
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
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [intersections, setIntersections] = useState<any[]>([]);

  useEffect(() => {
    if (location) {
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      setSelectedLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      fetchIntersections(location.coords.latitude, location.coords.longitude);
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

    try {
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await response.json();
      setIntersections(data.elements);
    } catch (error) {
      console.error('Error fetching intersections:', error);
    }
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
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={currentLocation}
          showsUserLocation
          showsMyLocationButton
          showsCompass
          onPress={handleLocationSelect}
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
              description="Tap to confirm this location"
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/0ea5e9/marker.png' }} 
                style={{ width: 30, height: 30 }} 
              />
            </Marker>
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
                style={{ width: 30, height: 30 }} 
              />
            </Marker>
          ))}
        </MapView>
      </View>

      <View style={{ position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 20, margin: 20, borderRadius: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>Welcome!</Text>
        <Text style={{ fontSize: 16, marginBottom: 20 }}>{user?.email}</Text>
        {errorMsg && <Text style={{ color: '#ef4444', marginBottom: 10 }}>{errorMsg}</Text>}
        
        <Pressable style={{ backgroundColor: '#ef4444', padding: 15, borderRadius: 5, width: '100%', maxWidth: 200 }} onPress={signOut}>
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>Sign Out</Text>
        </Pressable>
      </View>

      {selectedLocation && (
        <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'white', padding: 15, borderRadius: 10 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 10 }}>
            Selected: {selectedLocation.latitude.toFixed(4)}, 
            {selectedLocation.longitude.toFixed(4)}
          </Text>
          <Pressable 
            style={{ backgroundColor: '#0ea5e9', padding: 15, borderRadius: 5 }}
            onPress={() => {
              setSelectedLocation(null);
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>Confirm Location</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}