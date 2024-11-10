import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, MapType, Camera } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';
import Svg, { Path } from 'react-native-svg';
import { Map, Layers, Navigation2 } from 'lucide-react-native';
import { Modalize } from 'react-native-modalize';

const ANIMATION_INTERVAL = 16;
const SERVER_UPDATE_INTERVAL = 1000;
const INTERPOLATION_FACTOR = 0.15;
const USER_MARKER_SIZE = 32;
const OTHER_MARKER_SIZE = 24;

const UserMarker = ({ rotation = 0, color = '#0ea5e9', size = OTHER_MARKER_SIZE }) => (
  <Svg height={size} width={size} viewBox="0 0 24 24" style={{ transform: [{ rotate: `${rotation}deg` }] }}>
    <Path
      d="M12 2L2 22L12 18L22 22L12 2Z"
      fill={color}
      stroke="#FFFFFF"
      strokeWidth={1.5}
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
  const animationFrameId = useRef<number | null>(null);
  const lastServerUpdate = useRef(Date.now());
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(true);

  const StatusIndicator = ({ isFollowing, isReportMode }: { isFollowing: boolean; isReportMode: boolean }) => {
    let status = 'Manual Control';
    let bgColor = '#64748b';

    if (isFollowing) {
      status = 'Following';
      bgColor = '#10b981';
    }
    if (isReportMode) {
      status = 'Report Mode';
      bgColor = '#ef4444';
    }

    return (
      <View style={[styles.statusContainer, { backgroundColor: bgColor }]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    );
  };

  const targetLocation = useRef({
    latitude: 37.78825,
    longitude: -122.4324,
    heading: 0,
  });
  
  const currentAnimatedLocation = useRef({
    latitude: 37.78825,
    longitude: -122.4324,
    heading: 0,
  });

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

  const modalizeRef = useRef<Modalize>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
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
  const [isReportMode, setReportMode] = useState(false);

  const openModal = () => {
    modalizeRef.current?.open();
  };

  const closeModal = () => {
    modalizeRef.current?.close();
  };

  const interpolateValue = (current: number, target: number, factor: number): number => {
    return current + (target - current) * factor;
  };

  const normalizeHeading = (heading: number): number => {
    while (heading > 360) heading -= 360;
    while (heading < 0) heading += 360;
    return heading;
  };

  const interpolateHeading = (current: number, target: number, factor: number): number => {
    let diff = ((target - current + 180) % 360) - 180;
    return normalizeHeading(current + diff * factor);
  };

  const toggleControlMode = () => {
    setIsFollowingUser(prev => {
      const newFollowingState = !prev;
      if (newFollowingState) {
        const centerLatitude = currentAnimatedLocation.current.latitude;
        const centerLongitude = currentAnimatedLocation.current.longitude;
        const heading = currentAnimatedLocation.current.heading;

        mapRef.current?.animateCamera(
          {
            center: {
              latitude: centerLatitude,
              longitude: centerLongitude,
            },
            heading: heading,
            pitch: 60,
            zoom: 17,
            altitude: 1000,
          },
          {
            duration: 500,
          }
        );
      }
      return newFollowingState;
    });
    setReportMode(false);
  };

  const animate = () => {
    const { latitude: targetLat, longitude: targetLon, heading: targetHeading } = targetLocation.current;
    const { latitude: currentLat, longitude: currentLon, heading: currentHeading } = currentAnimatedLocation.current;

    // Smoothly interpolate all values
    const newLat = interpolateValue(currentLat, targetLat, INTERPOLATION_FACTOR);
    const newLon = interpolateValue(currentLon, targetLon, INTERPOLATION_FACTOR);
    const newHeading = interpolateHeading(currentHeading, targetHeading, INTERPOLATION_FACTOR);

    // Update the animated values
    currentAnimatedLocation.current = {
      latitude: newLat,
      longitude: newLon,
      heading: newHeading,
    };

    // Only update camera if in following mode
    if (isFollowingUser && !isReportMode) {
      setCamera(prev => ({
        ...prev,
        center: {
          latitude: newLat,
          longitude: newLon,
        },
        heading: newHeading,
      }));
    }

    // Always update current location for marker position
    setCurrentLocation(prev => ({
      ...prev,
      latitude: newLat,
      longitude: newLon,
    }));

    animationFrameId.current = requestAnimationFrame(animate);
  };

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const { latitude, longitude, heading } = location.coords;
    
    targetLocation.current = {
      latitude,
      longitude,
      heading: heading ?? targetLocation.current.heading,
    };

    const now = Date.now();
    if (now - lastServerUpdate.current >= SERVER_UPDATE_INTERVAL && user) {
      lastServerUpdate.current = now;
      
      try {
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
      } catch (error) {
        console.warn('Failed to update server location:', error);
      }
    }
  };

  const handleMapMovement = () => {
    if (isUserInteracting && !isReportMode) {
      setIsFollowingUser(false);
    }
  };

  useEffect(() => {
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      await Location.enableNetworkProviderAsync();
      
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 0,
          timeInterval: ANIMATION_INTERVAL,
        },
        handleLocationUpdate
      );

      animationFrameId.current = requestAnimationFrame(animate);

      return () => {
        locationSubscription.remove();
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    };

    const cleanup = startTracking();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
      if (user) {
        supabase.from('active_users').delete().eq('user_id', user.id);
      }
    };
  }, [user]);

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
    closeModal();
  };

  const toggleReportMode = () => {
    setReportMode(prev => !prev);
    setIsFollowingUser(false);
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
        showsMyLocationButton={false}
        showsCompass
        showsBuildings={true}
        showsTraffic={true}
        mapType={mapType}
        onPress={handleLocationSelect}
        customMapStyle={mapStyle}
        camera={camera}
        followsUserLocation={false}
        minZoomLevel={15}
        maxZoomLevel={20}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
        onPanDrag={() => {
          setIsUserInteracting(true);
          handleMapMovement();
        }}
        onTouchStart={() => {
          setIsUserInteracting(true);
        }}
        onTouchEnd={() => {
          setIsUserInteracting(false);
        }}
        onRegionChangeComplete={() => {
          if (isUserInteracting) {
            handleMapMovement();
          }
        }}
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
              latitude: currentAnimatedLocation.current.latitude,
              longitude: currentAnimatedLocation.current.longitude,
            }}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={currentAnimatedLocation.current.heading}
            zIndex={1000}
          >
            <UserMarker color="#0ea5e9" size={USER_MARKER_SIZE} />
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
            zIndex={100}
          >
            <UserMarker color="#10b981" size={OTHER_MARKER_SIZE} />
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

      <StatusIndicator isFollowing={isFollowingUser} isReportMode={isReportMode} />

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
        style={[
          styles.modeToggleButton, 
          isFollowingUser && styles.modeToggleButtonActive
        ]}
        onPress={toggleControlMode}
      >
        <Navigation2 
          size={24} 
          color="#fff" 
          style={{ 
            transform: [{ rotate: isFollowingUser ? '0deg' : '45deg' }],
            opacity: isFollowingUser ? 1 : 0.8
          }}
        />
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
  modeToggleButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    backgroundColor: '#64748b',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  modeToggleButtonActive: {
    backgroundColor: '#10b981',
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
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  closeButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusContainer: {
    position: 'absolute',
    top: 40,
    left: '50%',
    transform: [{ translateX: -50 }],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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

