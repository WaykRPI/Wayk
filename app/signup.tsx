import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Button, TextInput } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function Signup() {
   const router = useRouter();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');

   const handleSignup = () => {
      console.log('Signup:', email, password, confirmPassword);
   };

   return (
      <View style={styles.container}>
         <View style={styles.overlay}>
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

            <Button title='Sign Up' onPress={handleSignup} />

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
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
   },
   overlay: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
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
});
