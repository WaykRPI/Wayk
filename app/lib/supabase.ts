import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage implementation
const ExpoStorage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (error) {
        console.error('Error setting localStorage:', error);
        return;
      }
    } else {
      return AsyncStorage.setItem(key, value);
    }
  },
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        console.error('Error getting localStorage:', error);
        return null;
      }
    } else {
      return AsyncStorage.getItem(key);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (error) {
        console.error('Error removing localStorage:', error);
        return;
      }
    } else {
      return AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: ExpoStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);