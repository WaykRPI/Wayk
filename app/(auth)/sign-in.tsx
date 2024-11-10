// Login.tsx
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { authStyles, Colors } from './styles';
import { useLocationContext } from '../../contexts/LocationContext';
import { supabase } from '@/app/lib/supabase';

export default function Login() {
  const router = useRouter();
  const { errorMsg } = useLocationContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={authStyles.container}>
      <View style={authStyles.contentContainer}>
        {errorMsg && (
          <View style={authStyles.errorContainer}>
            <ThemedText style={authStyles.errorText}> 
              ⚠️ {errorMsg}
            </ThemedText>
          </View>
        )}

        <View style={authStyles.logoContainer}>
          <View style={authStyles.logoBox}>
            <Feather name="navigation" size={48} color={Colors.white} />
          </View>
          <ThemedText style={authStyles.title}>Welcome to Wayk</ThemedText>
          <ThemedText style={authStyles.subtitle}>
            Your community-powered walking companion
          </ThemedText>
        </View>

        {error && (
          <View style={authStyles.errorContainer}>
            <ThemedText style={authStyles.errorText}>{error}</ThemedText>
          </View>
        )}

        <View style={authStyles.inputContainer}>
          <ThemedText style={authStyles.inputLabel}>Email</ThemedText>
          <TextInput
            style={authStyles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={authStyles.inputContainer}>
          <ThemedText style={authStyles.inputLabel}>Password</ThemedText>
          <TextInput
            style={authStyles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={authStyles.forgotPassword}>
          <ThemedText style={authStyles.forgotPasswordText}>
            Forgot Password?
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[authStyles.button, loading && authStyles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <ThemedText style={authStyles.buttonText}>
            {loading ? 'Signing In...' : 'Sign In'}
          </ThemedText>
        </TouchableOpacity>

        <View style={authStyles.footer}>
          <ThemedText style={authStyles.footerText}>
            Don't have an account?{' '}
          </ThemedText>
          <TouchableOpacity onPress={() => router.replace('/signup')}>
            <ThemedText style={authStyles.footerLink}>Sign Up</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}