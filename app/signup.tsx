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

            <ThemedText
               style={styles.link}
               onPress={() => router.push('/login')}
            >
               Already have an account? Login
            </ThemedText>
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
   link: {
      marginTop: 20,
      textAlign: 'center',
      color: '#0a7ea4',
   },
});
