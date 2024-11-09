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
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      
      if (!isLocationEnabled) {
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

      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
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
        setErrorMsg('Permission to access location was denied');
        return false;
      }

      if (Platform.OS === 'ios') {
        try {
          const foregroundPermission = await Location.getForegroundPermissionsAsync();
          // @ts-ignore - iOS specific property
          if (foregroundPermission.ios?.scope === Location.LocationAccuracyTypes.REDUCED) {
            Alert.alert(
              "Precise Location Recommended",
              "For the best experience, please enable precise location in your device settings.",
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Open Settings", 
                  onPress: () => Linking.openURL('app-settings:')
                }
              ]
            );
          }
        } catch (error) {
          console.warn('Error checking precise location:', error);
        }
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(currentLocation);
      return true;
    } catch (error) {
      setErrorMsg('Error getting location');
      console.error(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    location,
    errorMsg,
    isLoading,
    checkAndRequestLocationPermissions
  };
};
