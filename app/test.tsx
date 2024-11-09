// components/TestConnection.tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { supabase } from './lib/supabase';

interface Location {
  id: string;
  created_at: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  type: string;
}

const TestConnection: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const testInsert = async () => {
    try {
      setLoading(true);
      setResult('Testing connection...');

      const { data, error } = await supabase
        .from('locations')
        .insert({
          title: 'Test Location',
          description: 'This is a test location',
          latitude: 37.7749,
          longitude: -122.4194,
          type: 'test'
        })
        .select()
        .single();

      if (error) {
        setResult(`Error: ${error.message}`);
        console.error('Detailed error:', error);
      } else {
        setResult(`Success! Inserted data: ${JSON.stringify(data, null, 2)}`);
      }

    } catch (e) {
      setResult(`Caught error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      console.error('Caught error:', e);
    } finally {
      setLoading(false);
    }
  };

  const testSelect = async () => {
    try {
      setLoading(true);
      setResult('Testing select...');

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .limit(5);

      if (error) {
        setResult(`Error: ${error.message}`);
        console.error('Detailed error:', error);
      } else {
        setResult(`Success! Found ${data?.length ?? 0} records: ${JSON.stringify(data, null, 2)}`);
      }

    } catch (e) {
      setResult(`Caught error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      console.error('Caught error:', e);
    } finally {
      setLoading(false);
    }
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
});

export default TestConnection;