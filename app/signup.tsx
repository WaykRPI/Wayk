import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Button, TextInput } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useLocationContext } from '../contexts/LocationContext';
import { supabase } from '@/app/lib/supabase';

export default function Signup() {
   const router = useRouter();
   const { errorMsg } = useLocationContext();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // Add console log to debug
   useEffect(() => {
      console.log('Location error in signup:', errorMsg);
   }, [errorMsg]);

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
            // Usually means email confirmation is required
            setError('Please check your email to confirm your account');
         }
      } catch (error: any) {
         setError(error.message || 'An error occurred during signup');
      } finally {
         setLoading(false);
      }
   };

   return (
      <View style={styles.container}>
         <View style={styles.overlay}>
            <View style={styles.topSection}>
               {errorMsg && (
                  <View style={styles.locationWarning}>
                     <ThemedText style={styles.warningText}>
                        ⚠️ {errorMsg}
                     </ThemedText>
                  </View>
               )}
               {error && (
                  <View style={styles.errorContainer}>
                     <ThemedText style={styles.errorText}>{error}</ThemedText>
                  </View>
               )}
            </View>

            <View style={styles.mainContent}>
               <View style={styles.formSection}>
                  <ThemedText type='title' style={styles.title}>
                     Create Account
                  </ThemedText>

                  <TextInput
                     style={styles.input}
                     placeholder='Email'
                     value={email}
                     onChangeText={setEmail}
                     autoCapitalize='none'
                     keyboardType='email-address'
                  />

                  <TextInput
                     style={styles.input}
                     placeholder='Password'
                     value={password}
                     onChangeText={setPassword}
                     secureTextEntry
                  />

                  <TextInput
                     style={styles.input}
                     placeholder='Confirm Password'
                     value={confirmPassword}
                     onChangeText={setConfirmPassword}
                     secureTextEntry
                  />

                  <Button
                     title={loading ? 'Creating Account...' : 'Sign Up'}
                     onPress={handleSignup}
                     disabled={loading}
                  />

                  <View style={styles.footer}>
                     <ThemedText style={styles.footerText}>
                        Already have an account?{' '}
                     </ThemedText>
                     <ThemedText
                        style={styles.linkText}
                        onPress={() => router.replace('/login')}
                     >
                        Login
                     </ThemedText>
                  </View>
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
      padding: 20,
      backgroundColor: Colors.transparent,
   },
   title: {
      marginBottom: 30,
      textAlign: 'center',
      color: Colors.lightText,
   },
   input: {
      height: 40,
      color: Colors.text,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 5,
      marginBottom: 15,
      paddingHorizontal: 10,
      backgroundColor: Colors.white,
   },
   linkText: {
      color: Colors.primary,
      fontWeight: '600',
   },
   footerText: {
      color: Colors.lightText,
      textAlign: 'center',
   },
   footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 30,
   },
   locationWarning: {
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      marginHorizontal: 20,
   },
   topSection: {
      marginTop: 40,
      width: '100%',
   },
   mainContent: {
      flex: 1,
      marginTop: 20,
   },
   formSection: {
      flex: 1,
      justifyContent: 'center',
   },
   warningText: {
      color: Colors.error,
      textAlign: 'center',
      fontSize: 14,
   },
   errorContainer: {
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
   },
   errorText: {
      color: Colors.error,
      textAlign: 'center',
   },
});
