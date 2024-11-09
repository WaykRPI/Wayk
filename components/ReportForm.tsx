import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../app/lib/supabase';

interface ReportFormProps {
  latitude: string;
  longitude: string;
  onReportSubmitted: () => void; // Callback to notify when a report is submitted
}

const ReportForm: React.FC<ReportFormProps> = ({ latitude, longitude, onReportSubmitted }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState<'obstacle' | 'construction'>('obstacle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!latitude || !longitude) {
      setError('Please provide latitude and longitude.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          user_id: user?.id,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          description,
          report_type: reportType,
        });

      if (error) throw error;

      // Clear the form after submission
      setDescription('');
      setReportType('obstacle');
      onReportSubmitted(); // Notify parent component
    } catch (error) {
      setError( 'An error occurred while submitting the report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report an Obstacle or Construction Site</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
      />
      <View style={styles.radioContainer}>
        <Button title="Obstacle" onPress={() => setReportType('obstacle')} />
        <Button title="Construction" onPress={() => setReportType('construction')} />
      </View>
      <Button title="Submit Report" onPress={handleSubmit} disabled={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});

export default ReportForm;