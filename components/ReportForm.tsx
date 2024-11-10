import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../app/lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface ReportFormProps {
  latitude: string;
  longitude: string;
  onReportSubmitted: () => void;
}

const ReportForm: React.FC<ReportFormProps> = ({ latitude, longitude, onReportSubmitted }) => {
  const { user } = useAuth();
  const [description, setDescription] = useState<string>('');
  const [reportType, setReportType] = useState<'obstacle' | 'construction'>('obstacle');
  const [loading, setLoading] = useState<boolean>(false);
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

      setDescription('');
      setReportType('obstacle');
      onReportSubmitted();
    } catch (error) {
      setError('An error occurred while submitting the report.');
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
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
      />
      <View style={styles.radioContainer}>
        <TouchableOpacity
          style={[styles.radioButton, reportType === 'obstacle' && styles.radioButtonActive]}
          onPress={() => setReportType('obstacle')}
        >
          <Text style={styles.radioText}>Obstacle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.radioButton, reportType === 'construction' && styles.radioButtonActive]}
          onPress={() => setReportType('construction')}
        >
          <Text style={styles.radioText}>Construction</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.submitButtonText}>{loading ? 'Submitting...' : 'Submit Report'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20, 
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  error: {
    color: '#e74c3c',
    marginBottom: 10,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  radioButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    marginRight: 5,
  },
  radioButtonActive: {
    backgroundColor: '#333',
  },
  radioText: {
    color: '#fff',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReportForm;
