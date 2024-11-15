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
   ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect, useRef } from 'react';

import MapView, {
   Marker,
   PROVIDER_GOOGLE,
   MapType,
   Camera,
   Callout,
   Polyline,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';
import PlacesSearch from '@/components/Search';
import Svg, { Path } from 'react-native-svg';
import { Map, Layers, Navigation2 } from 'lucide-react-native';
import { Modalize } from 'react-native-modalize';
import { Float } from 'react-native/Libraries/Types/CodegenTypes';
import {
   getWalkingDirections,
   RouteData,
} from '../../services/directionService';
import { DirectionsPanel } from '../../components/DirectionsPanel';
import { ChatModal } from '../../components/ChatModal';
import { AIChatModal } from '../../components/AIChatModal';

const ANIMATION_INTERVAL = 16;
const SERVER_UPDATE_INTERVAL = 1000;
const INTERPOLATION_FACTOR = 0.15;
const USER_MARKER_SIZE = 32;
const OTHER_MARKER_SIZE = 24;
const UserMarker = ({
   rotation = 0,
   color = '#0ea5e9',
   size = OTHER_MARKER_SIZE,
}) => (
   <Svg
      height={size}
      width={size}
      viewBox='0 0 24 24'
      style={{ transform: [{ rotate: `${rotation}deg` }] }}
   >
      <Path
         d='M12 2L2 22L12 18L22 22L12 2Z'
         fill={color}
         stroke='#FFFFFF'
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

interface ChatState {
   isOpen: boolean;
   selectedUser: ActiveUser | null;
}

interface Report {
   id: string;
   type: string;
   latitude: Float;
   longitude: Float;
   description: string;
   image_url?: string;
   accuracy_score?: string;
   ai_analysis?: string;
}

export default function Home() {
   const { user, signOut } = useAuth();
   const { location, errorMsg } = useLocationContext();
   const mapRef = useRef<MapView>(null);
   const animationFrameId = useRef<number | null>(null);
   const lastServerUpdate = useRef(Date.now());
   const [isUserInteracting, setIsUserInteracting] = useState(false);
   const [isFollowingUser, setIsFollowingUser] = useState(true);
   const [isRoutingMode, setIsRoutingMode] = useState(false);
   const [destination, setDestination] = useState<{
      latitude: number;
      longitude: number;
   } | null>(null);
   const [route, setRoute] = useState<RouteData | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [showDirections, setShowDirections] = useState(false);
   const [selectedSearchPlace, setSelectedSearchPlace] = useState(null);
   const [isSearchFocused, setIsSearchFocused] = useState(false);

   const handlePlaceSelect = async (place: any) => {
      console.log('Place selected:', place);
      if (!place || !place.latitude || !place.longitude || !location) return;

      setSelectedSearchPlace(place);

      // Animate to the selected location
      mapRef.current?.animateCamera({
         center: {
            latitude: place.latitude,
            longitude: place.longitude,
         },
         zoom: 17,
         duration: 1000,
      });

      // Set destination
      setDestination({
         latitude: place.latitude,
         longitude: place.longitude,
      });

      // Get and draw the route
      try {
         setIsLoading(true);
         const routeData = await getWalkingDirections(
            location.coords.latitude,
            location.coords.longitude,
            place.latitude,
            place.longitude
         );
         setRoute(routeData);
         setShowDirections(true);
      } catch (error) {
         console.error('Error getting directions:', error);
         // Optionally show an error message to the user
      } finally {
         setIsLoading(false);
      }

      // Exit routing mode if active
      if (isRoutingMode) {
         setIsRoutingMode(false);
      }

      // Exit report mode if active
      if (isReportMode) {
         setReportMode(false);
      }

      // Disable follow mode when selecting a place
      setIsFollowingUser(false);
   };

   const handleMapPress = async (event: any) => {
      if (isRoutingMode && location) {
         const { latitude, longitude } = event.nativeEvent.coordinate;
         setDestination({ latitude, longitude });

         try {
            setIsLoading(true);
            const routeData = await getWalkingDirections(
               location.coords.latitude,
               location.coords.longitude,
               latitude,
               longitude
            );
            setRoute(routeData);
            setShowDirections(true);
         } catch (error) {
            console.error('Error:', error);
            // Handle error appropriately
         } finally {
            setIsLoading(false);
         }
      }
   };

   const chatModalizeRef = useRef<Modalize>(null);
   const [chatState, setChatState] = useState<ChatState>({
      isOpen: false,
      selectedUser: null,
   });

   const StatusIndicator = ({
      isFollowing,
      isReportMode,
   }: {
      isFollowing: boolean;
      isReportMode: boolean;
   }) => {
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
         <>
            <View style={styles.statusContainer}>
               <Text style={styles.statusText}>{status}</Text>
            </View>

            <View style={styles.searchContainer}>
               <PlacesSearch onPlaceSelect={handlePlaceSelect} />
            </View>
         </>
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
   const [reports, setReports] = useState<Report[]>([]);
   const [modalVisible, setModalVisible] = useState<boolean>(false);
   const [isReportMode, setReportMode] = useState(false);
   const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [isImageModalVisible, setIsImageModalVisible] = useState(false);
   const [selectedReport, setSelectedReport] = useState<Report | null>(null);
   const genMiniModalizeRef = useRef<Modalize>(null);
   const aiChatModalizeRef = useRef<Modalize>(null);

   const openModal = () => {
      modalizeRef.current?.open();
   };

   const closeModal = () => {
      modalizeRef.current?.close();
   };

   const interpolateValue = (
      current: number,
      target: number,
      factor: number
   ): number => {
      return current + (target - current) * factor;
   };

   const normalizeHeading = (heading: number): number => {
      while (heading > 360) heading -= 360;
      while (heading < 0) heading += 360;
      return heading;
   };

   const interpolateHeading = (
      current: number,
      target: number,
      factor: number
   ): number => {
      let diff = ((target - current + 180) % 360) - 180;
      return normalizeHeading(current + diff * factor);
   };

   const toggleControlMode = () => {
      setIsFollowingUser((prev) => {
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
      const {
         latitude: targetLat,
         longitude: targetLon,
         heading: targetHeading,
      } = targetLocation.current;
      const {
         latitude: currentLat,
         longitude: currentLon,
         heading: currentHeading,
      } = currentAnimatedLocation.current;

      // Smoothly interpolate all values
      const newLat = interpolateValue(
         currentLat,
         targetLat,
         INTERPOLATION_FACTOR
      );
      const newLon = interpolateValue(
         currentLon,
         targetLon,
         INTERPOLATION_FACTOR
      );
      const newHeading = interpolateHeading(
         currentHeading,
         targetHeading,
         INTERPOLATION_FACTOR
      );

      // Update the animated values
      currentAnimatedLocation.current = {
         latitude: newLat,
         longitude: newLon,
         heading: newHeading,
      };

      // Only update camera if in following mode
      if (isFollowingUser && !isReportMode) {
         setCamera((prev) => ({
            ...prev,
            center: {
               latitude: newLat,
               longitude: newLon,
            },
            heading: newHeading,
         }));
      }

      // Always update current location for marker position
      setCurrentLocation((prev) => ({
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
               await supabase.from('active_users').insert({
                  user_id: user.id,
                  latitude,
                  longitude,
                  user_email: user.email,
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
         cleanup.then((cleanupFn) => cleanupFn?.());
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
               table: 'active_users',
            },
            (payload) => {
               setActiveUsers((current) => {
                  const activeTimeout = new Date();
                  activeTimeout.setMinutes(activeTimeout.getMinutes() - 5);

                  const filtered = current.filter(
                     (u) =>
                        new Date(u.last_updated) > activeTimeout &&
                        u.user_id !== user?.id
                  );

                  if (
                     payload.eventType !== 'DELETE' &&
                     payload.new.user_id !== user?.id
                  ) {
                     const exists = filtered.findIndex(
                        (u) => u.user_id === payload.new.user_id
                     );
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

         setCamera((prev) => ({
            ...prev,
            center: {
               latitude: location.coords.latitude,
               longitude: location.coords.longitude,
            },
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
         const response = await fetch(
            `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
               query
            )}`
         );
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
      closeModal();
   };

   const toggleReportMode = () => {
      setReportMode((prev) => !prev);
      setIsFollowingUser(false);
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
            followsUserLocation={false}
            minZoomLevel={15}
            maxZoomLevel={20}
            rotateEnabled={true}
            pitchEnabled={true}
            toolbarEnabled={false}
            onPanDrag={() => {
               if (!isSearchFocused) {
                  setIsUserInteracting(true);
                  handleMapMovement();
               }
            }}
            onTouchStart={() => {
               if (!isSearchFocused) {
                  setIsUserInteracting(true);
               }
            }}
            onTouchEnd={() => {
               if (!isSearchFocused) {
                  setIsUserInteracting(false);
               }
            }}
            onRegionChangeComplete={(region) => {
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
                  onPress={() => {
                     if (activeUser.user_id !== user?.id) {
                        // Prevent opening chat with yourself
                        setChatState({
                           isOpen: true,
                           selectedUser: activeUser,
                        });
                        chatModalizeRef.current?.open();
                     }
                  }}
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
            {destination && (
               <Marker
                  coordinate={destination}
                  title='Destination'
                  pinColor='blue'
               />
            )}

            {route && (
               <Polyline
                  coordinates={route.coordinates}
                  strokeWidth={4}
                  strokeColor='#2563eb'
               />
            )}
         </MapView>
         <StatusIndicator
            isFollowing={isFollowingUser}
            isReportMode={isReportMode}
         />
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
            style={[
               styles.modeToggleButton,
               isFollowingUser && styles.modeToggleButtonActive,
            ]}
            onPress={toggleControlMode}
         >
            <Navigation2
               size={24}
               color='#fff'
               style={{
                  transform: [{ rotate: isFollowingUser ? '0deg' : '45deg' }],
                  opacity: isFollowingUser ? 1 : 0.8,
               }}
            />
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

         <Modalize
            ref={chatModalizeRef}
            adjustToContentHeight
            onClose={() => {
               setChatState({ isOpen: false, selectedUser: null });
            }}
         >
            {chatState.isOpen && chatState.selectedUser && (
               <ChatModal
                  modalizeRef={chatModalizeRef}
                  currentUser={user}
                  selectedUser={chatState.selectedUser}
                  onClose={() => {
                     setChatState({ isOpen: false, selectedUser: null });
                     chatModalizeRef.current?.close();
                  }}
               />
            )}
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
               <Pressable
                  style={styles.imageModalContent}
                  onPress={(e) => e.stopPropagation()}
               >
                  {selectedImage ? (
                     <View>
                        <Image
                           source={{ uri: selectedImage }}
                           style={styles.imageModalImage}
                           resizeMode='cover'
                        />
                        <View style={styles.reportDetailsContainer}>
                           <View style={styles.reportHeader}>
                              <Text style={styles.reportTitle}>
                                 {selectedReport?.type}
                              </Text>
                           </View>
                           <View style={styles.descriptionContainer}>
                              <Text style={styles.reportDescription}>
                                 {selectedReport?.description ||
                                    'No description provided'}
                              </Text>
                           </View>
                           {selectedReport?.accuracy_score !== undefined && (
                              <View style={styles.accuracyContainer}>
                                 <Text style={styles.accuracyScore}>
                                    {`${selectedReport.accuracy_score}% Accurate`}
                                 </Text>
                              </View>
                           )}

                           {selectedReport?.ai_analysis && (
                              <View style={styles.aiAnalysisContainer}>
                                 <Text style={styles.aiAnalysisLabel}>
                                    AI Analysis
                                 </Text>
                                 <Text style={styles.aiAnalysisText}>
                                    {selectedReport.ai_analysis}
                                 </Text>
                              </View>
                           )}
                        </View>
                     </View>
                  ) : (
                     <View style={styles.basicReportContainer}>
                        <View style={styles.reportHeader}>
                           <Text style={styles.reportTitle}>
                              {selectedReport?.type}
                           </Text>
                        </View>
                        <View style={styles.descriptionContainer}>
                           <Text style={styles.reportDescription}>
                              {selectedReport?.description ||
                                 'No description provided'}
                           </Text>
                        </View>
                     </View>
                  )}
                  <Pressable
                     style={styles.imageModalCloseButton}
                     onPress={() => {
                        setIsImageModalVisible(false);
                        setSelectedReport(null);
                     }}
                  >
                     <Text style={styles.imageModalCloseText}>✕</Text>
                  </Pressable>
               </Pressable>
            </Pressable>
         </Modal>
         <Pressable
            style={[
               styles.routingButton,
               isRoutingMode && styles.routingButtonActive,
            ]}
            onPress={() => {
               setIsRoutingMode(!isRoutingMode);
               if (!isRoutingMode) {
                  setDestination(null);
                  setRoute(null);
                  setShowDirections(false);
               }
            }}
         >
            <Text style={styles.routingButtonText}>
               {isRoutingMode ? 'Cancel' : 'Set Walking Route'}
            </Text>
         </Pressable>

         {isLoading && (
            <View style={styles.loadingContainer}>
               <ActivityIndicator size='large' color='#2563eb' />
            </View>
         )}

         {showDirections && route && (
            <DirectionsPanel
               route={route}
               onClose={() => setShowDirections(false)}
            />
         )}
         <Pressable
            style={styles.genMiniButton}
            onPress={() => aiChatModalizeRef.current?.open()}
         >
            <Text style={styles.genMiniButtonText}>GenMini</Text>
         </Pressable>

         <AIChatModal
            modalizeRef={aiChatModalizeRef}
            reports={reports}
            onClose={() => aiChatModalizeRef.current?.close()}
            userLocation={
               location
                  ? {
                       latitude: location.coords.latitude,
                       longitude: location.coords.longitude,
                    }
                  : undefined
            }
         />
      </View>
   );
}

const styles = StyleSheet.create({
   routingButton: {
      position: 'absolute',
      bottom: 80,
      right: 20,
      backgroundColor: '#2563eb',
      borderRadius: 30,
      paddingHorizontal: 20,
      paddingVertical: 15,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
   },
   routingButtonActive: {
      backgroundColor: '#dc2626',
   },
   routingButtonText: {
      color: 'white',
      fontWeight: 'bold',
   },
   loadingContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -20 }, { translateY: -20 }],
   },
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
   searchContainer: {
      position: 'absolute',
      top: 120, // Moved up slightly to not interfere with other controls
      left: 20,
      right: 20,
      zIndex: 999, // Ensure it's above other elements
      elevation: 999, // For Android
   },
   statusContainer: {
      position: 'absolute',
      top: 40,
      left: '50%',
      transform: [{ translateX: -50 }],
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: '#64748b',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      zIndex: 998,
   },
   statusText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
   },
   imageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
   },
   imageModalContent: {
      width: '100%',
      backgroundColor: 'white',
      borderRadius: 16,
      overflow: 'hidden',
   },
   imageModalImage: {
      width: '100%',
      height: 250,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
   },
   reportDetailsContainer: {
      padding: 20,
   },
   basicReportContainer: {
      padding: 20,
   },
   reportHeader: {
      marginBottom: 12,
   },
   reportTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1f2937',
   },
   descriptionContainer: {
      marginBottom: 16,
   },
   reportDescription: {
      fontSize: 16,
      lineHeight: 24,
      color: '#4b5563',
   },
   accuracyContainer: {
      backgroundColor: '#f0fdf4',
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
   },
   accuracyScore: {
      fontSize: 16,
      fontWeight: '600',
      color: '#059669',
      textAlign: 'center',
   },
   aiAnalysisContainer: {
      backgroundColor: '#f3f4f6',
      padding: 16,
      borderRadius: 12,
   },
   aiAnalysisLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
   },
   aiAnalysisText: {
      fontSize: 15,
      lineHeight: 22,
      color: '#4b5563',
   },
   imageModalCloseButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
   },
   imageModalCloseText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
   },
   genMiniButton: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      backgroundColor: '#0ea5e9',
      borderRadius: 30,
      padding: 15,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
      zIndex: 5, // Match other buttons' z-index
   },
   genMiniButtonText: {
      color: '#fff',
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
