import { Stack, SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { LocationProvider } from '../contexts/LocationContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
     <GestureHandlerRootView style={styles.container}>
    <AuthProvider>
      <LocationProvider>
        <RootLayoutNav />
      </LocationProvider>
    </AuthProvider>
      </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.white,
        },
        headerShadowVisible: false,
        headerShown: false,
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="login" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="signup" 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen name="test" />
    </Stack>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});