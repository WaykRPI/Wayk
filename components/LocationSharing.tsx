import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { supabase } from '../app/lib/supabase';
import { User } from '@supabase/supabase-js';
import * as Location from 'expo-location';

interface LocationSharingProps {
  user: User | null;
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
}

interface ActiveUser {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  user_email: string;
}

export const LocationSharing: React.FC<LocationSharingProps> = ({ 
  user, 
  currentLocation 
}) => {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const locationUpdateInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (user && currentLocation) {
      // Subscribe to active users changes
      const subscription = supabase
        .channel('active_users')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'active_users'
          },
          (payload) => {
            handleActiveUsersUpdate(payload);
          }
        )
        .subscribe();

      // Initial fetch of active users
      fetchActiveUsers();

      // Update own location periodically
      updateOwnLocation();
      locationUpdateInterval.current = setInterval(updateOwnLocation, 10000);

      return () => {
        // Cleanup
        subscription.unsubscribe();
        if (locationUpdateInterval.current) {
          clearInterval(locationUpdateInterval.current);
        }
        removeOwnLocation();
      };
    }
  }, [user, currentLocation]);

  const handleActiveUsersUpdate = (payload: any) => {
    if (payload.eventType === 'DELETE') {
      setActiveUsers(prev => prev.filter(u => u.id !== payload.old.id));
    } else if (payload.eventType === 'INSERT') {
      setActiveUsers(prev => [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setActiveUsers(prev => 
        prev.map(u => u.id === payload.new.id ? payload.new : u)
      );
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('active_users')
        .select('*')
        .neq('user_id', user?.id);
      
      if (error) throw error;
      if (data) setActiveUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching active users');
      console.error('Error fetching active users:', err);
    }
  };

  const updateOwnLocation = async () => {
    if (!currentLocation || !user) return;

    try {
      const { error } = await supabase
        .from('active_users')
        .upsert({
          user_id: user.id,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          user_email: user.email,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating location');
      console.error('Error updating location:', err);
    }
  };

  const removeOwnLocation = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('active_users')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error removing location:', err);
    }
  };

  // Calculate time since last update
  const getLastUpdateTime = (lastUpdated: string) => {
    const diff = Date.now() - new Date(lastUpdated).getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes < 1 ? 'Just now' : `${minutes}m ago`;
  };

  return (
    <>
      {activeUsers.map((activeUser) => (
        <Marker
          key={activeUser.id}
          coordinate={{
            latitude: activeUser.latitude,
            longitude: activeUser.longitude,
          }}
          title={activeUser.user_email}
          description={`Last seen: ${getLastUpdateTime(activeUser.last_updated)}`}
        >
          <View style={styles.otherUserMarker}>
            <View style={styles.otherUserDot} />
          </View>
        </Marker>
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );
};

const styles = StyleSheet.create({
  otherUserMarker: {
    backgroundColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: 20,
    padding: 8,
  },
  otherUserDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34D399',
  },
  error: {
    position: 'absolute',
    top: 90,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 10,
    borderRadius: 5,
    color: 'white',
  },
});