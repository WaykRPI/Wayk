import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export default function Home() {
  const { user, signOut } = useAuth();
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(prev => ({
          ...prev,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }));
      } catch (error) {
        setErrorMsg('Error getting location');
        console.error(error);
      }
    })();
  }, []);

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
      setErrorMsg('Error saving location');
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
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
              description="Tap to confirm this location"
              pinColor="#0ea5e9"
            />
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
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
});