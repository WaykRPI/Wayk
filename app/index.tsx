import { View, ActivityIndicator } from "react-native";
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { errorMsg, checkAndRequestLocationPermissions } = useLocationContext();

  useEffect(() => {
    checkAndRequestLocationPermissions();
  }, []);

  // Show loading indicator while checking auth status
  if (authLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
      }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Handle redirect based on auth state
  if (!user) {
    return <Redirect href="/login" />;
  }
}