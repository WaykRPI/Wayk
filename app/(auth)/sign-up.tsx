// Signup.tsx
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '../../components/ThemedText';
import { authStyles, Colors } from './styles';
import { useLocationContext } from '../../contexts/LocationContext';
import { supabase } from '@/app/lib/supabase';

export default function Signup() {
  const router = useRouter();
  const { errorMsg } = useLocationContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/');
      } else {
        setError('Please check your email to confirm your account');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during signup');
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
          <ThemedText style={authStyles.title}>Join Wayk</ThemedText>
          <ThemedText style={authStyles.subtitle}>
            Help make walking safer for everyone
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
            placeholder="Create a password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <View style={authStyles.inputContainer}>
          <ThemedText style={authStyles.inputLabel}>Confirm Password</ThemedText>
          <TextInput
            style={authStyles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[authStyles.button, loading && authStyles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <ThemedText style={authStyles.buttonText}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </ThemedText>
        </TouchableOpacity>

        <View style={authStyles.footer}>
          <ThemedText style={authStyles.footerText}>
            Already have an account?{' '}
          </ThemedText>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <ThemedText style={authStyles.footerLink}>Sign In</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}