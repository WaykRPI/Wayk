import { View } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from '../components/ThemedText';
import { Button } from 'react-native';

export default function Index() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
      }}
    >
      <ThemedText type="title">Welcome to Wayk</ThemedText>
      <Button title="Login" onPress={() => router.push('/login')} />
      <Button title="Sign Up" onPress={() => router.push('/signup')} />
      <Button title="Go to Test" onPress={() => router.push('/test')} />
    </View>
  );
}

