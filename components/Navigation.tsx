import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';

interface Place {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface NavigationState {
  origin: Place | null;
  destination: Place | null;
  route: any[] | null;
  eta: number | null;
  distance: number | null;
  isNavigating: boolean;
}

const NavigationScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    origin: null,
    destination: null,
    route: null,
    eta: null,
    distance: null,
    isNavigating: false,
  });
  const [intersections, setIntersections] = useState<any[]>([]);
  const [searchBarHeight] = useState(new Animated.Value(150));

  // Get current location on mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // Set origin as current location
      setNavigationState(prev => ({
        ...prev,
        origin: {
          id: 'current-location',
          name: 'Current Location',
          address: '',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      }));

      // Fetch nearby intersections
      fetchIntersections(location.coords.latitude, location.coords.longitude);
    })();
  }, []);

  // Handle keyboard show/hide animations
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        Animated.timing(searchBarHeight, {
          toValue: 300,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(searchBarHeight, {
          toValue: 150,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

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
      const response = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setIntersections(data.elements);
    } catch (error) {
      console.error('Error fetching intersections:', error);
    }
  };

  const searchPlaces = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Using Nominatim for geocoding (replace with your preferred geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=5`
      );
      const data = await response.json();
      
      const places: Place[] = data.map((item: any) => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        address: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
      
      setSearchResults(places);
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaceSelect = (place: Place) => {
    setNavigationState(prev => ({
      ...prev,
      destination: place,
    }));
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();

    // Calculate route
    if (navigationState.origin) {
      calculateRoute(navigationState.origin, place);
    }
  };

  const calculateRoute = async (origin: Place, destination: Place) => {
    // Use A* algorithm to find the route through intersections
    const path = findPath(
      {
        id: -1,
        lat: origin.latitude,
        lon: origin.longitude,
      },
      {
        id: -2,
        lat: destination.latitude,
        lon: destination.longitude,
      },
      intersections.map(int => ({
        id: int.id,
        lat: int.lat,
        lon: int.lon,
      }))
    );

    const route = path.map(node => ({
      latitude: node.lat,
      longitude: node.lon,
    }));

    // Calculate ETA (assuming average speed of 5 km/h for walking)
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      distance += calculateDistance(
        route[i].latitude,
        route[i].longitude,
        route[i + 1].latitude,
        route[i + 1].longitude
      );
    }

    const eta = (distance / 5) * 60; // minutes

    setNavigationState(prev => ({
      ...prev,
      route,
      eta,
      distance,
      isNavigating: true,
    }));
  };

  const startNavigation = () => {
    setNavigationState(prev => ({
      ...prev,
      isNavigating: true,
    }));
  };

  const stopNavigation = () => {
    setNavigationState(prev => ({
      ...prev,
      destination: null,
      route: null,
      eta: null,
      distance: null,
      isNavigating: false,
    }));
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={currentLocation || undefined}
        showsUserLocation
        showsMyLocationButton
        showsCompass
      >
        {navigationState.destination && (
          <Marker
            coordinate={{
              latitude: navigationState.destination.latitude,
              longitude: navigationState.destination.longitude,
            }}
            title={navigationState.destination.name}
            description={navigationState.destination.address}
          />
        )}

        {navigationState.route && (
          <Polyline
            coordinates={navigationState.route}
            strokeColor="#0ea5e9"
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        )}

        {intersections.map(intersection => (
          <Marker
            key={intersection.id}
            coordinate={{
              latitude: intersection.lat,
              longitude: intersection.lon,
            }}
            title="Intersection"
            description="Traffic signal or crossing"
            pinColor="yellow"
          />
        ))}
      </MapView>

      <Animated.View style={[styles.searchContainer, { height: searchBarHeight }]}>
        <View style={styles.searchBar}>
          <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Where to?"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchPlaces(text);
            }}
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator style={styles.loadingIndicator} />}
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.searchResult}
              onPress={() => handlePlaceSelect(item)}
            >
              <Text style={styles.placeName}>{item.name}</Text>
              <Text style={styles.placeAddress}>{item.address}</Text>
            </Pressable>
          )}
          style={styles.searchResults}
        />
      </Animated.View>

      {navigationState.destination && !navigationState.isNavigating && (
        <View style={styles.navigationPanel}>
          <Text style={styles.destinationName}>
            {navigationState.destination.name}
          </Text>
          {navigationState.eta && (
            <Text style={styles.eta}>
              {Math.round(navigationState.eta)} min ({(navigationState.distance || 0).toFixed(1)} km)
            </Text>
          )}
          <Pressable style={styles.startButton} onPress={startNavigation}>
            <Text style={styles.buttonText}>Start Navigation</Text>
          </Pressable>
        </View>
      )}

      {navigationState.isNavigating && (
        <View style={styles.navigationPanel}>
          <Text style={styles.navigationInfo}>
            {Math.round(navigationState.eta || 0)} min remaining
          </Text>
          <Text style={styles.navigationDistance}>
            {(navigationState.distance || 0).toFixed(1)} km to destination
          </Text>
          <Pressable style={styles.stopButton} onPress={stopNavigation}>
            <Text style={styles.buttonText}>End Navigation</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingIndicator: {
    marginLeft: 10,
  },
  searchResults: {
    marginTop: 10,
  },
  searchResult: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  placeAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  navigationPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  eta: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  startButton: {
    backgroundColor: '#0ea5e9',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  navigationInfo: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  navigationDistance: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
});

export default NavigationScreen;