import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { RouteData } from '../services/directionService';

interface DirectionsPanelProps {
  route: RouteData;
  onClose: () => void;
}

export const DirectionsPanel = ({ route, onClose }: DirectionsPanelProps) => {
  return (
    <View style={styles.panel}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {(route.distance / 1000).toFixed(2)}km • {Math.round(route.duration / 60)}min
        </Text>
        <Pressable 
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.stepsContainer}>
        {route.steps.map((step, index) => (
          <View key={index} style={styles.stepItem}>
            <Text style={styles.stepText}>{step.text}</Text>
            <Text style={styles.stepDistance}>
              {step.distance < 1000 
                ? `${Math.round(step.distance)}m` 
                : `${(step.distance / 1000).toFixed(2)}km`}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 10,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  stepsContainer: {
    marginTop: 10,
  },
  stepItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginRight: 10,
  },
  stepDistance: {
    fontSize: 14,
    color: '#6b7280',
  },
});