import { View, Text, Pressable, StyleSheet, Image, Modal } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';
import ReportForm from '../../components/ReportForm';

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
  const mapStyle = [
    {
      elementType: 'geometry',
      stylers: [{ color: '#1d1d1d' }], // Black background for general map area
    },
    {
      elementType: 'labels.icon',
      stylers: [{ visibility: 'off' }],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [{ color: '#80b3ff' }], // Light blue text for readability
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#1d1d1d' }], // Match background for subtle effect
    },
    {
      featureType: 'administrative',
      elementType: 'geometry',
      stylers: [{ color: '#2e2e2e' }], // Dark grey for administrative boundaries
    },
    {
      featureType: 'administrative.country',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#6699cc' }], // Medium blue for country labels
    },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#80b3ff' }], // Light blue for locality labels
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#5a8fc1' }], // Softer blue for points of interest
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#1a1a1a' }], // Darker black for parks
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#4a90e2' }], // Medium blue for park labels
    },
    {
      featureType: 'road',
      elementType: 'geometry.fill',
      stylers: [{ color: '#2e2e2e' }], // Dark grey for roads
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#6699cc' }], // Medium blue for road labels
    },
    {
      featureType: 'road.arterial',
      elementType: 'geometry',
      stylers: [{ color: '#3a3a3a' }], // Dark grey for arterial roads
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#4a4a4a' }], // Slightly lighter grey for highways
    },
    {
      featureType: 'road.highway.controlled_access',
      elementType: 'geometry',
      stylers: [{ color: '#5b5b5b' }], // Light grey for controlled-access highways
    },
    {
      featureType: 'road.local',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#4a90e2' }], // Light blue for local road labels
    },
    {
      featureType: 'transit',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#5a8fc1' }], // Softer blue for transit labels
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#1c3f5f' }], // Deep blue for water bodies
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#80b3ff' }], // Light blue for water labels
    },
  ];
  

  const [intersections, setIntersections] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [isReportMode, setReportMode] = useState(false);

  useEffect(() => {
    if (location) {
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
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
    setModalVisible(true);
  };

  const handleReportSubmitted = () => {
    fetchReports();
    setSelectedLocation(null);
    setModalVisible(false);
  };

  const toggleReportMode = () => {
    setReportMode(!isReportMode);
    setSelectedLocation(null); // Clear selected location if toggling off
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={currentLocation}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        onPress={handleLocationSelect}
         customMapStyle={mapStyle}  
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

      <Pressable style={[styles.toggleButton, isReportMode && styles.toggleButtonActive]} onPress={toggleReportMode}>
        <Text style={styles.toggleButtonText}>{isReportMode ? 'Exit Report Mode' : 'Enter Report Mode'}</Text>
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