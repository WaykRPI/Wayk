import { Stack } from "expo-router";
import { Colors } from '../constants/Colors';
import { LocationProvider } from '../contexts/LocationContext';

export default function RootLayout() {
  return (
    <LocationProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerShadowVisible: false,
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
    </LocationProvider>
  );
}
