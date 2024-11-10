import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker, PROVIDER_GOOGLE, MapType } from 'react-native-maps';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';
import Svg, { Path } from 'react-native-svg';
import { Map, Layers } from 'lucide-react-native';
import { Modalize } from 'react-native-modalize';

const UserMarker = ({ rotation = 0, color = '#0ea5e9' }) => (
  <Svg height={24} width={24} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${rotation}deg` }] }}>
    <Path
      d="M12 2L2 22L12 18L22 22L12 2Z"
      fill={color}
      stroke="#FFFFFF"
      strokeWidth={1}
    />
  </Svg>
);

interface ActiveUser {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  user_email: string;
}

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
  const screenHeight = Dimensions.get('window').height;
  const bottomSheetHeight = screenHeight * 0.5; // Adjust as needed

  const translateY = useRef(new Animated.Value(bottomSheetHeight)).current;
   const modalizeRef = useRef<Modalize>(null);

  const openModal = () => {
    modalizeRef.current?.open();
  };

  const closeModal = () => {
    modalizeRef.current?.close();
  };

 
  const [mapType, setMapType] = useState<MapType>('standard');
  const [camera, setCamera] = useState({
    center: {
      latitude: 37.78825,
      longitude: -122.4324,
    },
    pitch: 85,
    altitude: 250,
    heading: 0,
    zoom: 17,
  });

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [watchLocation, setWatchLocation] = useState<any>(null);
  const [intersections, setIntersections] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReportMode, setReportMode] = useState(false);

  // Initial fetch of active users
  useEffect(() => {
    const fetchActiveUsers = async () => {
      const { data, error } = await supabase
        .from('active_users')
        .select('*');
      if (data && !error) {
        setActiveUsers(data);
      }
    };
    fetchActiveUsers();
  }, []);

  // Watch user's location
  useEffect(() => {
    const startWatchingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 1000
        },
        async (newLocation) => {
          const { latitude, longitude } = newLocation.coords;

          if (user) {
            const { data: existingUser } = await supabase
              .from('active_users')
              .select('id')
              .eq('user_id', user.id)
              .single();

            if (existingUser) {
              await supabase
                .from('active_users')
                .update({
                  latitude,
                  longitude,
                })
                .eq('user_id', user.id);
            } else {
              await supabase
                .from('active_users')
                .insert({
                  user_id: user.id,
                  latitude,
                  longitude,
                  user_email: user.email
                });
            }
          }
        }
      );

      setWatchLocation(watchId);
    };

    startWatchingLocation();
    return () => {
      if (watchLocation) {
        watchLocation.remove();
      }
      if (user) {
        supabase.from('active_users').delete().eq('user_id', user.id);
      }
    };
  }, [user]);

  // Subscribe to active users changes
  useEffect(() => {
    const subscription = supabase
      .channel('active_users')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_users'
        },
        (payload) => {
          setActiveUsers(current => {
            const activeTimeout = new Date();
            activeTimeout.setMinutes(activeTimeout.getMinutes() - 5);

            const filtered = current.filter(u =>
              new Date(u.last_updated) > activeTimeout &&
              u.user_id !== user?.id
            );

            if (payload.eventType !== 'DELETE' && payload.new.user_id !== user?.id) {
              const exists = filtered.findIndex(u => u.user_id === payload.new.user_id);
              if (exists >= 0) {
                filtered[exists] = payload.new as ActiveUser;
              } else {
                filtered.push(payload.new as ActiveUser);
              }
            }

            return filtered;
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (location) {
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      setCamera(prev => ({
        ...prev,
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
      }));
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

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase.from('reports').select('*');
      if (error) throw error;
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleLocationSelect = (event: any) => {
    if (!isReportMode) return;
  
    const coords = event.nativeEvent.coordinate;
    setSelectedLocation(coords);
    openModal(); 
  };
  

  const handleReportSubmitted = () => {
    fetchReports();
    setSelectedLocation(null);
    setModalVisible(false);
  };

  const toggleReportMode = () => {
    setReportMode(!isReportMode);
    setSelectedLocation(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentLocation}
        showsUserLocation={false}
        showsMyLocationButton
        showsCompass
        showsBuildings={true}
        showsTraffic={true}
        mapType={mapType}
        onPress={handleLocationSelect}
        customMapStyle={mapStyle}
        camera={camera}
      >
        {/* Current user marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <UserMarker color="#0ea5e9" />
          </Marker>
        )}

        {/* Other active users */}
        {activeUsers.map((activeUser) => (
          <Marker
            key={activeUser.id}
            coordinate={{
              latitude: activeUser.latitude,
              longitude: activeUser.longitude,
            }}
            title={activeUser.user_email?.split('@')[0] || 'Anonymous'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <UserMarker color="#10b981" />
          </Marker>
        ))}

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

        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{
              latitude: report.latitude,
              longitude: report.longitude,
            }}
            title={report.report_type === 'obstacle' ? 'Obstacle' : 'Construction'}
            description={report.description}
            pinColor={report.report_type === 'obstacle' ? 'red' : 'orange'}
          />
        ))}
      </MapView>

      <Pressable
        style={styles.mapTypeButton}
        onPress={() => setMapType(prev => prev === 'standard' ? 'hybrid' : 'standard')}
      >
        {mapType === 'standard' ? (
          <Layers size={24} color="#fff" />
        ) : (
          <Map size={24} color="#fff" />
        )}
      </Pressable>

      <Pressable
        style={[styles.toggleButton, isReportMode && styles.toggleButtonActive]}
        onPress={toggleReportMode}
      >
        <Text style={styles.toggleButtonText}>
          {isReportMode ? 'Exit Report Mode' : 'Enter Report Mode'}
        </Text>
      </Pressable>

      <Modalize
        ref={modalizeRef}
        adjustToContentHeight
        onClosed={() => setModalVisible(false)}
      >
        <View style={styles.modalContent}>
          <ReportForm
            latitude={selectedLocation?.latitude.toString() || ''}
            longitude={selectedLocation?.longitude.toString() || ''}
            onReportSubmitted={handleReportSubmitted}
          />
          <Pressable onPress={closeModal} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </Modalize>
    </View>
  );
}

const styles = StyleSheet.create({
  mapTypeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  toggleButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#0ea5e9',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  toggleButtonActive: {
    backgroundColor: '#ef4444',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginVertical: 10,
  },
  modalContent: {
    paddingHorizontal: 20, // Added horizontal padding
    paddingVertical: 10,   // Added vertical padding
    backgroundColor: '#fff', // Optional, ensures consistent background
  },
  closeButton: {
    marginTop: 20,          // Increased margin to separate from form
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const mapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1d1d1d' }],
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#80b3ff' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#1d1d1d' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#2e2e2e' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6699cc' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#80b3ff' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5a8fc1' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a90e2' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2e2e2e' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6699cc' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#3a3a3a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#4a4a4a' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#5b5b5b' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a90e2' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5a8fc1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1c3f5f' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#80b3ff' }],
  },
];