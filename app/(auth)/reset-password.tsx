import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'expo-router';
import { ThemedText } from '../../components/ThemedText';
import { Colors } from '../../constants/Colors';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const { resetPassword, updatePassword, session } = useAuth();

  const handleResetPassword = async () => {
    if (!email && !session) {
      setError('Please enter your email');
      return;
    }

    if (session && !password) {
      setError('Please enter a new password');
      return;
    }

    if (session && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      if (session) {
        await updatePassword(password);
        setSuccess(true);
      } else {
        await resetPassword(email);
        setSuccess(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success && !session) {
    return (
      <View style={styles.container}>
        <View style={styles.overlay}>
          <View style={styles.header}>
            <ThemedText type='title' style={styles.title}>
              Check your email
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              We've sent you a password reset link. Please click the link to reset your password.
            </ThemedText>
          </View>

          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity style={styles.button}>
              <ThemedText style={styles.buttonText}>Back to Sign In</ThemedText>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <ThemedText type='title' style={styles.title}>
            {session ? 'Update Password' : 'Reset Password'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {session ? 'Enter your new password' : 'Enter your email to reset your password'}
          </ThemedText>
        </View>

        {error && (
          <ThemedText style={styles.error}>
            {error}
          </ThemedText>
        )}

        <View style={styles.form}>
          {!session && (
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.lightText}
                editable={!loading}
              />
            </View>
          )}
          
          {session && (
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>New Password</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={Colors.lightText}
                editable={!loading}
              />
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.button, { opacity: loading ? 0.5 : 1 }]} 
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <ThemedText style={styles.buttonText}>
                {session ? 'Update Password' : 'Send Reset Link'}
              </ThemedText>
            )}
          </TouchableOpacity>

          {!session && (
            <View style={styles.footer}>
              <Link href="/(auth)/sign-in" asChild>
                <TouchableOpacity>
                  <ThemedText style={styles.linkText}>Back to Sign In</ThemedText>
                </TouchableOpacity>
              </Link>
            </View>
          )}
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
    marginTop: 20,
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
    color: Colors.error || '#ef4444',
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
  },
});