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
import NavigationScreen from '../../components/Navigation'; // Import NavigationScreen
import Svg, { Path } from 'react-native-svg';
import { Map, Layers } from 'lucide-react-native';
import { Modalize } from 'react-native-modalize';

// Define constants for animation and server update intervals, marker sizes, etc.
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
  const bottomSheetHeight = screenHeight * 0.5;
  const translateY = useRef(new Animated.Value(bottomSheetHeight)).current;
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
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReportMode, setReportMode] = useState(false);

  const openModal = () => {
    modalizeRef.current?.open();
  };

  const closeModal = () => {
    modalizeRef.current?.close();
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
      { duration: 0 }
    );
  };

  // Location update handler and server syncing function
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
              user_email: user.email,
            });
        }
      } catch (error) {
        console.warn('Failed to update server location:', error);
      }
    }
  };

  // Location tracking and animation setup
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

  // Fetch active users on initial render
  useEffect(() => {
    const fetchActiveUsers = async () => {
      const { data, error } = await supabase.from('active_users').select('*');
      if (data && !error) setActiveUsers(data);
    };
    fetchActiveUsers();
  }, []);

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
        {/* Render Markers */}
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
      </MapView>

      {/* Add the NavigationScreen component here */}
      <NavigationScreen /> 

      {/* Map Type Button */}
      <Pressable
        style={styles.mapTypeButton}
        onPress={() => setMapType((prevType) => (prevType === 'standard' ? 'hybrid' : 'standard'))}
      >
        <Layers color="white" />
      </Pressable>

      {/* Center Map Button */}
      <Pressable style={styles.centerButton} onPress={centerOnUser}>
        <Map color="white" />
      </Pressable>

      {/* Modal for Reporting */}
      <Modalize ref={modalizeRef} snapPoint={bottomSheetHeight} modalHeight={bottomSheetHeight}>
        <ReportForm onSubmit={closeModal} />
      </Modalize>
    </View>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    position: 'absolute',
    bottom: 150,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#0ea5e9',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapTypeButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#0ea5e9',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

