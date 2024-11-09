import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from '../components/ThemedText';
import { Button } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();

  // Show loading indicator while checking auth status
  if (loading) {
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
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(app)/home" />;
}