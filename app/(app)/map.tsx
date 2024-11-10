import { View, Text, Pressable, StyleSheet, Image, TextInput, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../hooks/useAuth';
import MapView, { Marker } from 'react-native-maps';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useLocationContext } from '../../contexts/LocationContext';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const obstacleTypes = [
  'Construction',
  'Road Damage',
  'Sidewalk Obstruction',
  'Traffic Signal Issue',
  'Other'
];

export default function Home() {
  const { user } = useAuth();
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
  const [intersections, setIntersections] = useState<any[]>([]); // State to hold intersection nodes
  const [modalVisible, setModalVisible] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [obstacleType, setObstacleType] = useState(obstacleTypes[0]);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      // Fetch intersections when location is available
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

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();
    setIntersections(data.elements); // Set the intersection nodes
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const validateSubmission = () => {
    if (!image) {
      alert('Please select an image');
      return false;
    }
    if (!description.trim()) {
      alert('Please add a description');
      return false;
    }
    if (!selectedLocation) {
      alert('Please select a location on the map');
      return false;
    }
    return true;
  };

  const analyzeImageAndDescription = async (imageBase64: string, description: string) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Please analyze this image and compare it to the following description: "${description}". Rate the accuracy of the description from 0% to 100%, {percentage}, along with an explaination, {reason}. Then, return a json with the format
                  {
                    'rating' : {pecentage},
                    'reason' : {reason},
                  }.
                  Nothing else
                  `
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64
                  }
                }
              ]
            }
          ],
          max_tokens: 300
        })
      });

      const data = await response.json();
      const analysisText = data.choices[0]?.message?.content;
      
      // Extract percentage from the response
      const percentageMatch = analysisText.match(/(\d+)%/);
      return {
        accuracy: percentageMatch ? parseInt(percentageMatch[1]) : null,
        analysis: analysisText
      };
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  };

  const onSubmit = async () => {
    if (!validateSubmission()) return;

    try {
      setIsSubmitting(true);

      // Analyze image and description
      const analysis = await analyzeImageAndDescription(image!, description);
      setAccuracy(analysis.accuracy);

      // Save to Supabase
      const { error } = await supabase
        .from('obstacles')
        .insert({
          user_id: user?.id,
          latitude: selectedLocation!.latitude,
          longitude: selectedLocation!.longitude,
          type: obstacleType,
          description: description,
          image_url: image,
          accuracy_score: analysis.accuracy,
          ai_analysis: analysis.analysis,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Reset form
      setImage(null);
      setDescription('');
      setSelectedLocation(null);
      setModalVisible(false);
      alert('Obstacle reported successfully!');

    } catch (error) {
      console.error('Error submitting obstacle:', error);
      alert('Error submitting obstacle. Please try again.');
    } finally {
      setIsSubmitting(false);
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
          customMapStyle={mapStyle} // Custom map style
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
              description="Tap to confirm this location"
            >
              <Image 
                source={{ uri: 'https://img.icons8.com/ios-filled/50/0ea5e9/marker.png' }} 
                style={styles.marker} 
              /> {/* Custom marker */}
            </Marker>
          )}
          {/* Render intersection markers */}
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
                style={styles.marker} 
              /> {/* Custom marker for intersections */}
            </Marker>
          ))}
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

      {/* Submission Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Report Obstacle</Text>

          <Pressable style={styles.imageButton} onPress={pickImage}>
            <Text style={styles.buttonText}>
              {image ? 'Change Image' : 'Pick an Image'}
            </Text>
          </Pressable>

          {image && (
            <Image source={{ uri: image }} style={styles.previewImage} />
          )}

          <Picker
            selectedValue={obstacleType}
            style={styles.picker}
            onValueChange={(itemValue) => setObstacleType(itemValue)}
          >
            {obstacleTypes.map((type) => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>

          <TextInput
            style={styles.input}
            placeholder="Describe the obstacle..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Add Report Button */}
      {selectedLocation && (
        <Pressable
          style={styles.reportButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.buttonText}>Report Obstacle</Text>
        </Pressable>
      )}
    </View>
  );
}

// Sample custom map style
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden', // To round the corners of the map
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
  marker: {
    width: 30,
    height: 30,
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 50
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15
  },
  imageButton: {
    backgroundColor: '#0ea5e9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    width: '100%'
  },
  previewImage: {
    width: 200,
    height: 200,
    marginVertical: 10,
    borderRadius: 10
  },
  picker: {
    width: '100%',
    marginVertical: 10
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  submitButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    marginTop: 10
  },
  cancelButton: {
    marginTop: 10,
    padding: 15
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  reportButton: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 5,
    width: '90%',
    maxWidth: 400
  }
});