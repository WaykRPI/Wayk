import { View, Text, Pressable, StyleSheet, Image, Modal, Dimensions } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker, PROVIDER_GOOGLE, MapType, Camera } from 'react-native-maps';
import React, { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';
import Svg, { Path } from 'react-native-svg';
import { Map, Layers } from 'lucide-react-native';

const ULTRA_HIGH_FREQUENCY = 5; // 5ms update interval
const MAX_HEADING_DELTA = 2; // Maximum heading change per frame

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
  const mapRef = useRef<MapView>(null);
  const lastUpdate = useRef(Date.now());
  const lastHeading = useRef(0);
  const isAnimating = useRef(false);
  const watchLocation = useRef<Location.LocationSubscription | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastLocation = useRef<Location.LocationObject | null>(null);

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

  const [mapType, setMapType] = useState<MapType>('standard');
  const [userHeading, setUserHeading] = useState(0);
  const [camera, setCamera] = useState<Camera>({
    center: {
      latitude: 37.78825,
      longitude: -122.4324,
    },
    pitch: 60,
    heading: 0,
    zoom: 17,
    altitude: 1000,
  });

  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [intersections, setIntersections] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReportMode, setReportMode] = useState(false);

  const smoothHeading = (currentHeading: number | null, prevHeading: number): number => {
    // If heading is null, return the previous heading
    if (currentHeading === null) {
      return prevHeading;
    }
  
    let diff = ((currentHeading - prevHeading + 180) % 360) - 180;
    diff = Math.max(Math.min(diff, MAX_HEADING_DELTA), -MAX_HEADING_DELTA);
    return (prevHeading + diff + 360) % 360;
  };
  
  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const now = Date.now();
    const { latitude, longitude, heading } = location.coords;
    
    if (now - lastUpdate.current < ULTRA_HIGH_FREQUENCY || isAnimating.current) {
      return;
    }
    
    isAnimating.current = true;
    lastUpdate.current = now;
  
    const smoothedHeading = smoothHeading(heading, lastHeading.current);
    lastHeading.current = smoothedHeading;
    setUserHeading(smoothedHeading);
  
    try {
      await mapRef.current?.animateCamera(
        {
          center: { latitude, longitude },
          heading: smoothedHeading,
          pitch: 60,
          zoom: 17,
          altitude: 1000,
        },
        {
          duration: ULTRA_HIGH_FREQUENCY,
        }
      );
  
      setCamera(prev => ({
        ...prev,
        center: { latitude, longitude },
        heading: smoothedHeading,
      }));
  
      setCurrentLocation(prev => ({
        ...prev,
        latitude,
        longitude,
      }));
  
      // Update user location in Supabase
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
    } catch (e) {
      console.warn('Camera animation failed:', e);
    }
  
    isAnimating.current = false;
  };

  // Ultra-fast location tracking setup
  useEffect(() => {
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      await Location.enableNetworkProviderAsync();
      
      watchLocation.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 0,
          timeInterval: ULTRA_HIGH_FREQUENCY,
        },
        (location) => {
          lastLocation.current = location;
        }
      );

      // High-frequency update loop
      const updateLoop = () => {
        if (lastLocation.current) {
          handleLocationUpdate(lastLocation.current);
        }
        animationFrameId.current = requestAnimationFrame(updateLoop);
      };

      updateLoop();
    };

    startTracking();
    
    return () => {
      watchLocation.current?.remove();
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (user) {
        supabase.from('active_users').delete().eq('user_id', user.id);
      }
    };
  }, [user]);

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
    setModalVisible(true);
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
        ref={mapRef}
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
        followsUserLocation={true}
        minZoomLevel={15}
        maxZoomLevel={20}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
        onMapReady={() => {
          mapRef.current?.setNativeProps({
            renderToHardwareTextureAndroid: true,
            shouldRasterizeIOS: true,
          });
        }}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={userHeading}
          >
            <UserMarker color="#0ea5e9" />
          </Marker>
        )}

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

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ReportForm
              latitude={selectedLocation?.latitude.toString() || ''}
              longitude={selectedLocation?.longitude.toString() || ''}
              onReportSubmitted={handleReportSubmitted}
            />
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  closeButton: {
    marginTop: 10,
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