import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useRouter } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { Colors } from '../../constants/Colors';
import { Provider } from '@supabase/supabase-js';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { signInWithEmail, signInWithOAuth, signInWithMagicLink } = useAuth();
  const router = useRouter();

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await signInWithEmail(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <ThemedText type='title' style={styles.title}>
            Welcome Back
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to continue
          </ThemedText>
        </View>

        {error && (
          <ThemedText style={styles.error}>
            {error}
          </ThemedText>
        )}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={styles.input}
              placeholder='Enter your email'
              value={email}
              onChangeText={setEmail}
              autoCapitalize='none'
              keyboardType='email-address'
              placeholderTextColor={Colors.lightText}
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={styles.input}
              placeholder='Enter your password'
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={Colors.lightText}
              editable={!loading}
            />
          </View>

          <Link href="/(auth)/reset-password" asChild>
            <TouchableOpacity style={styles.forgotPassword}>
              <ThemedText style={styles.forgotPasswordText}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>
          </Link>
          <TouchableOpacity 
            style={[styles.button, { opacity: loading ? 0.5 : 1 }]} 
            onPress={handleEmailSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <ThemedText style={styles.buttonText}>Sign In</ThemedText>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Don't have an account?{' '}
            </ThemedText>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <ThemedText style={styles.linkText}>Sign Up</ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
     flex: 1,
  },
  overlay: {
     flex: 1,
     padding: 24,
     backgroundColor: Colors.transparent,
  },
  header: {
     marginTop: 60,
  },
  title: {
     marginTop: 60,
     marginBottom: 10,
     textAlign: 'center',
     color: Colors.lightText,
  },
  subtitle: {
     fontSize: 16,
     color: Colors.lightText,
     textAlign: 'center',
  },
  form: {
     gap: 10,
  },
  inputContainer: {
     gap: 8,
  },
  label: {
     fontSize: 14,
     marginLeft: 4,
  },
  input: {
     height: 50,
     borderWidth: 1,
     borderColor: Colors.border,
     borderRadius: 12,
     paddingHorizontal: 16,
     fontSize: 16,
     backgroundColor: Colors.white,
  },
  forgotPassword: {
     alignSelf: 'flex-end',
  },
  forgotPasswordText: {
     color: Colors.primary,
     fontSize: 14,
  },
  button: {
     height: 50,
     backgroundColor: Colors.primary,
     borderRadius: 12,
     justifyContent: 'center',
     alignItems: 'center',
     marginTop: 20,
  },
  buttonText: {
     color: Colors.white,
     fontSize: 16,
     fontWeight: '600',
  },
  footer: {
     flexDirection: 'row',
     justifyContent: 'center',
     marginTop: 20,
  },
  footerText: {
     color: Colors.lightText,
  },
  linkText: {
     color: Colors.primary,
     fontWeight: '600',
  },
  error: {
    color: 'red', 
    marginBottom: 10,
  },
});
