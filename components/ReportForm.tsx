import React, { useState } from 'react';
import {
   View,
   Text,
   TextInput,
   TouchableOpacity,
   StyleSheet,
   Image,
   Alert,
} from 'react-native';
import { supabase } from '../app/lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';

const GEN_AI_KEY = process.env.EXPO_PUBLIC_GEN_AI_KEY;

const obstacleTypes = [
   'Construction',
   'Road Damage',
   'Sidewalk Obstruction',
   'Traffic Signal Issue',
   'Other',
];

interface ReportFormProps {
   latitude: string;
   longitude: string;
   onReportSubmitted: () => void;
}

const ReportForm: React.FC<ReportFormProps> = ({
   latitude,
   longitude,
   onReportSubmitted,
}) => {
   const { user } = useAuth();
   const [description, setDescription] = useState<string>('');
   const [reportType, setReportType] = useState<'obstacle' | 'construction'>(
      'obstacle'
   );
   const [loading, setLoading] = useState<boolean>(false);
   const [error, setError] = useState<string | null>(null);
   const [image, setImage] = useState<string | null>(null);
   const [accuracy, setAccuracy] = useState<number | null>(null);
   const [selectedType, setSelectedType] = useState<string>(obstacleTypes[0]);

   const handleTakePhoto = async () => {
      const result = await ImagePicker.launchCameraAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsEditing: false, // Remove editing
         quality: 1,
         base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
         setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
   };

   const pickImage = async () => {
      const { status: libraryStatus } =
         await ImagePicker.requestMediaLibraryPermissionsAsync();
      const { status: cameraStatus } =
         await ImagePicker.requestCameraPermissionsAsync();

      if (libraryStatus !== 'granted' && cameraStatus !== 'granted') {
         Alert.alert(
            'Permission required',
            'Camera and media library permissions are needed.'
         );
         return;
      }

      Alert.alert(
         'Add Photo',
         'Choose a method',
         [
            {
               text: 'Take Photo',
               onPress: async () => {
                  const result = await ImagePicker.launchCameraAsync({
                     mediaTypes: ImagePicker.MediaTypeOptions.Images,
                     allowsEditing: false, // Remove editing
                     quality: 1,
                     base64: true,
                  });

                  if (!result.canceled && result.assets[0].base64) {
                     setImage(
                        `data:image/jpeg;base64,${result.assets[0].base64}`
                     );
                  }
               },
            },
            {
               text: 'Choose from Library',
               onPress: async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                     mediaTypes: ImagePicker.MediaTypeOptions.Images,
                     allowsEditing: false, // Remove editing
                     quality: 1,
                     base64: true,
                  });

                  if (!result.canceled && result.assets[0].base64) {
                     setImage(
                        `data:image/jpeg;base64,${result.assets[0].base64}`
                     );
                  }
               },
            },
            {
               text: 'Cancel',
               style: 'cancel',
            },
         ],
         { cancelable: true }
      );
   };

   const analyzeImageAndDescription = async (
      imageBase64: string,
      description: string,
      obstacleType: string
   ) => {
      try {
         if (!GEN_AI_KEY) {
            throw new Error('Gemini API key not configured');
         }

         const headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEN_AI_KEY,
         };

         const payload = {
            contents: [
               {
                  parts: [
                     {
                        text: `You are a professional WayK user, who is only going to examine pictures that are related to sidewalks and walking. WalkK is an application that is like Waze, the popular driving app, but for walking. Users are able to report obstructions on the road, sidewalk, stairs, and any walking area place while theyre walking just like how Waze can report certain events. Your goal right now is to take the role of an auditor and given a picture, description (optional), and obstacleType (predetermined), determine how "fit" and accurate the description and picture is. Please analyze this image and compare it to the following description: "${description}". Please note that the description can be NULL or NONE so use obstacle type in its place if it is ever NULL
              
                        The reported obstacle type is: "${obstacleType}". If the obstacle type is other, try to compare the image to one of these predefined fields 'Construction', 'Road Damage', 'Sidewalk Obstruction', and 'Traffic Signal Issue'. If it matches one of the above fields or something similar in the category, it deserves a good rating. If not, rate it a 0. Please do not be extreme on your rating, there are several cases where users are trying to report an issue but accidentally click the wrong obstacleType, instead knock down some points in the rating and state that in the analysis. 

                        Rate the accuracy of the description and obstacle type from 0% to 100% (it is ok to have odd percentage numbers), {percentage}, 
                        along with an explanation, {reason} (please keep the explanation at 1 sentence long at maximum). Then, return a json with the format
                        {
                          'rating' : {percentage},
                          'reason' : {reason},
                        }.
                        Nothing else`,
                     },
                     {
                        inline_data: {
                           mime_type: 'image/jpeg',
                           data: imageBase64.replace(
                              /^data:image\/[a-z]+;base64,/,
                              ''
                           ),
                        },
                     },
                  ],
               },
            ],
         };

         const response = await fetch(
            'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
            {
               method: 'POST',
               headers,
               body: JSON.stringify(payload),
            }
         );
         if (!response.ok) {
            throw new Error(
               `API request failed with status ${response.status}`
            );
         }

         const result = await response.json();
         const analysis_text = result.candidates[0].content.parts[0].text;

         try {
            // First try to parse the analysis_text as JSON
            const outer_json = JSON.parse(analysis_text);

            // Check if it's already the format we want
            if (outer_json.rating !== undefined) {
               return {
                  accuracy: Number(outer_json.rating) || 0,
                  analysis: outer_json.reason || '',
               };
            }

            // If not, try to parse the string content as JSON
            const matches = analysis_text.match(/'rating'\s*:\s*(\d+)/);
            const reasonMatch = analysis_text.match(/'reason'\s*:\s*'([^']+)'/);

            return {
               accuracy: matches ? Number(matches[1]) : 0,
               analysis: reasonMatch ? reasonMatch[1] : analysis_text,
            };
         } catch (jsonError) {
            // If JSON parsing fails, try regex as fallback
            const matches = analysis_text.match(/'rating'\s*:\s*(\d+)/);
            const reasonMatch = analysis_text.match(/'reason'\s*:\s*'([^']+)'/);

            return {
               accuracy: matches ? Number(matches[1]) : 0,
               analysis: reasonMatch ? reasonMatch[1] : analysis_text,
            };
         }
      } catch (error) {
         console.error('Error analyzing image:', error);
         // Return default values instead of throwing
         return {
            accuracy: 0,
            analysis: 'Error analyzing image',
         };
      }
   };

   const handleSubmit = async () => {
      if (!latitude || !longitude) {
         setError('Please provide latitude and longitude.');
         return;
      }

      setLoading(true);
      setError(null);

      try {
         let analysis = {
            accuracy: 0,
            analysis: 'No image provided',
         };

         if (image) {
            analysis = await analyzeImageAndDescription(
               image,
               description,
               selectedType
            );
            console.log(analysis);
         }
         // Ensure accuracy is a number
         const accuracyValue = Number(analysis.accuracy) || 0;
         setAccuracy(accuracyValue);

         let { error } = await supabase.from('reports').insert({
            user_id: user?.id,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            description: description,
            type: selectedType,
            image_url: image,
            accuracy_score: accuracyValue,
            ai_analysis: analysis.analysis,
            created_at: new Date().toISOString(),
         });

         if (error) throw error;

         // Reset form
         setDescription('');
         setSelectedType(obstacleTypes[0]);
         setImage(null);
         onReportSubmitted();
      } catch (error) {
         setError('An error occurred while submitting the report.');
         console.error('Submission error:', error);
      } finally {
         setLoading(false);
      }
   };

   return (
      <View style={styles.container}>
         <Text style={styles.title}>Reporting</Text>
         {error && <Text style={styles.error}>{error}</Text>}

         {/* Image Capture Section */}
         <Text style={styles.subtitle}>Photo</Text>
         <View style={styles.imageSection}>
            {image ? (
               <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: image }} style={styles.imagePreview} />
                  <TouchableOpacity
                     style={[styles.typeButton, styles.typeButtonActive]}
                     onPress={pickImage}
                  >
                     <Text style={styles.typeButtonTextActive}>
                        Change Photo
                     </Text>
                  </TouchableOpacity>
               </View>
            ) : (
               <TouchableOpacity
                  style={[styles.typeButton, styles.fullWidthButton]}
                  onPress={handleTakePhoto}
               >
                  <Text style={styles.typeButtonText}>Take Photo</Text>
               </TouchableOpacity>
            )}
         </View>

         <Text style={styles.subtitle}>Obstruction Type</Text>
         {/* Obstacle Type Selection - 2 per row with Other centered */}
         <View style={styles.typeContainer}>
            {obstacleTypes.slice(0, -1).map((type, index) => (
               <TouchableOpacity
                  key={type}
                  style={[
                     styles.typeButton,
                     styles.halfWidthButton,
                     selectedType === type && styles.typeButtonActive,
                  ]}
                  onPress={() => setSelectedType(type)}
               >
                  <Text
                     style={[
                        styles.typeButtonText,
                        selectedType === type && styles.typeButtonTextActive,
                     ]}
                  >
                     {type}
                  </Text>
               </TouchableOpacity>
            ))}
            {/* Other button centered */}
            <TouchableOpacity
               style={[
                  styles.typeButton,
                  styles.centerButton,
                  selectedType === 'Other' && styles.typeButtonActive,
               ]}
               onPress={() => setSelectedType('Other')}
            >
               <Text
                  style={[
                     styles.typeButtonText,
                     selectedType === 'Other' && styles.typeButtonTextActive,
                  ]}
               >
                  Other
               </Text>
            </TouchableOpacity>
         </View>

         {/* Rest of your existing form components */}
         <TextInput
            style={styles.input}
            placeholder='Description (optional)'
            placeholderTextColor='#888'
            value={description}
            onChangeText={setDescription}
         />
         <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
         >
            <Text style={styles.submitButtonText}>
               {loading ? 'Submitting...' : 'Submit Report'}
            </Text>
         </TouchableOpacity>
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      backgroundColor: '#f2f2f2',
      borderRadius: 10,
      padding: 20,
      margin: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 3,
   },
   title: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 15,
      textAlign: 'center',
   },
   subtitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginBottom: 15,
   },
   error: {
      color: '#e74c3c',
      marginBottom: 10,
      fontSize: 14,
   },
   input: {
      borderWidth: 1,
      borderColor: '#ddd',
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 10,
      fontSize: 16,
      color: '#333',
      marginBottom: 15,
   },
   radioContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
   },
   radioButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#e0e0e0',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 5,
      minHeight: 44,
   },
   radioButtonActive: {
      backgroundColor: '#333',
   },
   radioText: {
      color: '#fff',
      fontWeight: '500',
   },
   submitButton: {
      backgroundColor: '#333',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
   },
   submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
   },
   typeContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 15,
   },
   typeButton: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#ddd',
      backgroundColor: '#fff',
      marginBottom: 8,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 44,
   },
   fullWidthButton: {
      width: '100%',
   },
   halfWidthButton: {
      width: '48%',
   },
   centerButton: {
      width: '48%',
      marginHorizontal: 'auto',
   },
   typeButtonActive: {
      backgroundColor: '#333',
      borderColor: '#333',
   },
   typeButtonText: {
      color: '#666',
      fontSize: 14,
      textAlign: 'center',
   },
   typeButtonTextActive: {
      color: '#fff',
   },
   imageSection: {
      marginBottom: 20,
   },
   imageButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
   },
   cameraButton: {
      flex: 1,
      backgroundColor: '#0ea5e9',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
   },
   galleryButton: {
      flex: 1,
      backgroundColor: '#333',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
   },
   imagePreviewContainer: {
      alignItems: 'center',
      gap: 10,
   },
   imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      marginBottom: 10,
   },
   changePhotoButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#0ea5e9',
   },
   changePhotoText: {
      color: '#fff',
      fontWeight: '600',
   },
});

export default ReportForm;
