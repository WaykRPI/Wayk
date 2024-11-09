import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export const useLocation = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAndRequestLocationPermissions = async () => {
    try {
      setIsLoading(true);
      console.log('Checking location permissions...'); // Debug log

      // First check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      console.log('Location services enabled:', isLocationEnabled); // Debug log
      
      if (!isLocationEnabled) {
        setErrorMsg('Please enable location services to use this app');
        Alert.alert(
          "Location Services Disabled",
          "Please enable location services to use this app.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return false;
      }

      // Request foreground permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      console.log('Foreground permission status:', foregroundStatus); // Debug log
      
      if (foregroundStatus !== 'granted') {
        setErrorMsg('Location permission is required to use this app');
        Alert.alert(
          "Permission Denied",
          "We need location permissions to show relevant information. Please enable it in settings.",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Open Settings", 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return false;
      }

      // Try to get current location
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        console.log('Got location:', currentLocation); // Debug log
        setLocation(currentLocation);
        setErrorMsg(null);
        return true;
      } catch (error) {
        console.error('Error getting location:', error); // Debug log
        setErrorMsg('Unable to get your location. Please check your settings.');
        return false;
      }

    } catch (error) {
      console.error('Location permission error:', error); // Debug log
      setErrorMsg('Error accessing location services');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Request permissions immediately when the hook is used
  useEffect(() => {
    checkAndRequestLocationPermissions();
  }, []);

  return {
    location,
    errorMsg,
    isLoading,
    checkAndRequestLocationPermissions
  };
};
