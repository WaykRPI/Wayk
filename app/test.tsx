import React from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router'; // Import useRouter for navigation

const TestConnection: React.FC = () => {
  const router = useRouter(); // Initialize the router
  const [loading, setLoading] = React.useState(false); // State for loading
  const [result, setResult] = React.useState<string>(''); // State for result

  const testInsert = async () => {
    // Your insert logic here
    // Example: setLoading(true); and perform the insert operation
    // setResult('Insert successful!'); or handle errors
  };

  const testSelect = async () => {
    // Your select logic here
    // Example: setLoading(true); and perform the select operation
    // setResult('Select successful!'); or handle errors
  };

  const handleGoToHome = () => {
    router.replace('/home'); // Navigate to (app)/home screen
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Supabase Connection Test</Text>
      
      <View style={styles.buttonContainer}>
        <Button
          title="Test Insert"
          onPress={testInsert}
          disabled={loading}
        />
        <View style={styles.buttonSpacer} />
        <Button
          title="Test Select"
          onPress={testSelect}
          disabled={loading}
        />
      </View>

      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Result:</Text>
        <Text style={styles.resultText}>{result}</Text>
      </View>

      {/* Button to go to Home */}
      <View style={styles.homeButtonContainer}>
        <Button
          title="Go to Home"
          onPress={handleGoToHome} // Call the function to navigate to home
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  buttonSpacer: {
    height: 10,
  },
  resultContainer: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontFamily: 'monospace',
  },
  homeButtonContainer: {
    marginTop: 20,
  },
});

export default TestConnection;