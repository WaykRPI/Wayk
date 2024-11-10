import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, MapType, Camera, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';
import Svg, { Path } from 'react-native-svg';
import { Map, Layers } from 'lucide-react-native';
import { Modalize } from 'react-native-modalize';
import { Float } from 'react-native/Libraries/Types/CodegenTypes';

const ANIMATION_INTERVAL = 16; // ~60fps
const SERVER_UPDATE_INTERVAL = 1000; // Update server every second
const INTERPOLATION_FACTOR = 0.15; // Smooth interpolation factor
const USER_MARKER_SIZE = 32; // Larger size for user marker
const OTHER_MARKER_SIZE = 24; // Original size for other users

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

interface Report {
   id: string;
   type: string;
   latitude: Float;
   longitude: Float;
   description: string;
   image_url?: string;
   accuracy_score?: Number;
   ai_analysis?: string;
}

export default function Home() {
  const { user, signOut } = useAuth();
  const { location, errorMsg } = useLocationContext();
  const mapRef = useRef<MapView>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastServerUpdate = useRef(Date.now());
  
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
  const [reports, setReports] = useState<Report[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReportMode, setReportMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

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

  const centerOnUser = () => {
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
        duration: 0,
      }
    );
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

    // Always center on user
    centerOnUser();

    setCamera(prev => ({
      ...prev,
      center: {
        latitude: newLat,
        longitude: newLon,
      },
      heading: newHeading,
    }));

    // Update current location for markers
    setCurrentLocation(prev => ({
      ...prev,
      latitude: newLat,
      longitude: newLon,
    }));

    // Continue the animation loop
    animationFrameId.current = requestAnimationFrame(animate);
  };

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const { latitude, longitude, heading } = location.coords;
    
    // Update target location
    targetLocation.current = {
      latitude,
      longitude,
      heading: heading ?? targetLocation.current.heading,
    };

    // Check if we should update the server
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

  // Set up location tracking and animation
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

      // Start the animation loop
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
      console.log(data, error);
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

  const handleMarkerPress = (report: Report) => {
    if (report) {
      setSelectedReport(report);
      setSelectedImage(report.image_url || null);
      setIsImageModalVisible(true);
    }
  };

  return (
     <View style={{ flex: 1 }}>
        <MapView
           ref={mapRef}
           style={{ flex: 1 }}
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
           onRegionChangeComplete={() => {
              // Force center on user when map is moved
              if (!isReportMode) {
                 centerOnUser();
              }
           }}
        >
           {location && (
              <Marker
                 coordinate={{
                    latitude: currentAnimatedLocation.current.latitude,
                    longitude: currentAnimatedLocation.current.longitude,
                 }}
                 title='You'
                 anchor={{ x: 0.5, y: 0.5 }}
                 rotation={currentAnimatedLocation.current.heading}
                 zIndex={1000}
              >
                 <UserMarker color='#0ea5e9' size={USER_MARKER_SIZE} />
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
                 <UserMarker color='#10b981' size={OTHER_MARKER_SIZE} />
              </Marker>
           ))}

           {selectedLocation && (
              <Marker
                 coordinate={selectedLocation}
                 title='Selected Location'
                 description='Tap to confirm this location'
              >
                 <Image
                    source={{
                       uri: 'https://img.icons8.com/ios-filled/50/0ea5e9/marker.png',
                    }}
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
                 title='Intersection'
                 description='Traffic signal or crossing'
              >
                 <Image
                    source={{
                       uri: 'https://img.icons8.com/ios-filled/50/ffcc00/marker.png',
                    }}
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
                 onPress={() => handleMarkerPress(report)}
              >
                 {report.image_url ? (
                    <Image
                       source={{ uri: report.image_url }}
                       style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          borderWidth: 2,
                          borderColor: '#fff',
                       }}
                       resizeMode='cover'
                    />
                 ) : (
                    <View
                       style={{
                          backgroundColor: '#ef4444',
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: '#fff',
                       }}
                    />
                 )}
              </Marker>
           ))}
        </MapView>

        <Pressable
           style={styles.mapTypeButton}
           onPress={() =>
              setMapType((prev) =>
                 prev === 'standard' ? 'hybrid' : 'standard'
              )
           }
        >
           {mapType === 'standard' ? (
              <Layers size={24} color='#fff' />
           ) : (
              <Map size={24} color='#fff' />
           )}
        </Pressable>

        <Pressable
           style={[styles.mapTypeButton, { top: 80 }]}
           onPress={centerOnUser}
        >
           <Text style={styles.buttonIcon}>⌖</Text>
        </Pressable>

        <Pressable
           style={[
              styles.toggleButton,
              isReportMode && styles.toggleButtonActive,
           ]}
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

        <Modal
           visible={isImageModalVisible}
           transparent={true}
           onRequestClose={() => {
              setIsImageModalVisible(false);
              setSelectedReport(null);
           }}
        >
           <Pressable
              style={styles.imageModalOverlay}
              onPress={() => {
                 setIsImageModalVisible(false);
                 setSelectedReport(null);
              }}
           >
              <View style={styles.imageModalContent}>
                 <ScrollView style={styles.scrollView}>
                    {selectedImage && (
                       <Image
                          source={{ uri: selectedImage }}
                          style={styles.imageModalImage}
                          resizeMode='cover'
                       />
                    )}
                    <Text>
                       {selectedReport && (
                          <View style={styles.reportDetails}>
                             <View style={styles.reportRow}>
                                <Text style={styles.reportLabel}>Type:</Text>
                                <Text style={styles.reportValue}>
                                   {selectedReport.type}
                                </Text>
                             </View>

                             <View style={styles.reportRow}>
                                <Text style={styles.reportLabel}>
                                   Description:
                                </Text>
                                <Text style={styles.reportValue}>
                                   {selectedReport.description ||
                                      'No description provided'}
                                </Text>
                             </View>

                             {selectedReport.accuracy_score !== undefined && (
                                <View style={styles.reportRow}>
                                   <Text style={styles.reportLabel}>
                                      Accuracy Score:
                                   </Text>
                                   <Text style={styles.reportValue}>
                                      {String(selectedReport.accuracy_score)}
                                   </Text>
                                </View>
                             )}

                             {selectedReport.ai_analysis && (
                                <View style={styles.reportRow}>
                                   <Text style={styles.reportLabel}>
                                      AI Analysis:
                                   </Text>
                                   <Text style={styles.reportValue}>
                                      {selectedReport.ai_analysis}
                                   </Text>
                                </View>
                             )}
                          </View>
                       )}
                    </Text>
                 </ScrollView>
                 <Pressable
                    style={styles.imageModalCloseButton}
                    onPress={() => {
                       setIsImageModalVisible(false);
                       setSelectedReport(null);
                    }}
                 >
                    <Text style={styles.imageModalCloseText}>✕</Text>
                 </Pressable>
              </View>
           </Pressable>
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
  calloutContainer: {
    width: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  calloutContent: {
    padding: 10,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: 'black',
  },
  calloutDescription: {
    fontSize: 14,
    color: '#666',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    maxHeight: '80%', // Increased to accommodate more content
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    position: 'relative',
  },
  imageModalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: -15,
    right: -15,
    backgroundColor: '#0ea5e9',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  reportType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0ea5e9',
    marginBottom: 8,
  },
  reportDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 24,
  },
  reportAccuracy: {
    fontSize: 15,
    color: '#059669',
    marginBottom: 8,
  },
  reportAnalysis: {
    fontSize: 15,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  scrollView: {
    maxHeight: '100%',
  },
  
  reportRow: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  
  reportLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginRight: 8,
    minWidth: 100,
  },
  
  reportValue: {
    fontSize: 16,
    color: '#6B7280',
    flex: 1,
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