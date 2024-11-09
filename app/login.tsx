import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '../components/ThemedText';
import { Colors } from '../constants/Colors';
import { useLocationContext } from '../contexts/LocationContext';

export default function Login() {
   const router = useRouter();
   const { errorMsg } = useLocationContext();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');

   useEffect(() => {
      console.log('Location error in login:', errorMsg);
   }, [errorMsg]);

   const handleLogin = () => {
      console.log('Login:', email, password);
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
            </View>

            <View style={styles.mainContent}>
               <View style={styles.header}>
                  <ThemedText type='title' style={styles.title}>
                     Welcome Back
                  </ThemedText>
                  <ThemedText style={styles.subtitle}>
                     Sign in to continue
                  </ThemedText>
               </View>

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
                     />
                  </View>

                  <TouchableOpacity style={styles.forgotPassword}>
                     <ThemedText style={styles.forgotPasswordText}>
                        Forgot Password?
                     </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.button} onPress={handleLogin}>
                     <ThemedText style={styles.buttonText}>Sign In</ThemedText>
                  </TouchableOpacity>

                  <View style={styles.footer}>
                     <ThemedText style={styles.footerText}>
                        Don't have an account?{' '}
                     </ThemedText>
                     <TouchableOpacity onPress={() => router.replace('/signup')}>
                        <ThemedText style={styles.linkText}>Sign Up</ThemedText>
                     </TouchableOpacity>
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
      padding: 24,
      backgroundColor: Colors.transparent,
   },
   topSection: {
      marginTop: 40,
      width: '100%',
   },
   mainContent: {
      flex: 1,
      marginTop: 20,
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
   locationWarning: {
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      padding: 10,
      borderRadius: 8,
      marginHorizontal: 20,
   },
   warningText: {
      color: Colors.error,
      textAlign: 'center',
      fontSize: 14,
   },
});
