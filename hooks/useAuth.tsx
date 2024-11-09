import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from 'app/lib/supabase';
import { Session, User, Provider, AuthError } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

interface AuthContextData {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: Provider) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

function useProtectedRoute(user: User | null, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Only run navigation logic if loading is complete
    if (!loading) {
      // Check if the path is in the auth group
      const inAuthGroup = segments[0] === '(auth)';
      
      // Get the specific auth route if we're in the auth group
      const authRoute = inAuthGroup ? segments[1] : null;
      
      // Check if we're in the reset-password flow
      const inResetPassword = authRoute === 'reset-password';

      if (!user && !inAuthGroup) {
        // If no user and not in auth group, redirect to sign in
        router.replace('/(auth)/sign-in');
      } else if (user && inAuthGroup && !inResetPassword) {
        // If user exists and in auth group (except reset-password), redirect to home
        router.replace('/');
      }
    }
  }, [user, segments, loading]);
}

// Export the AuthContext and useAuth hook
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Pass loading state to useProtectedRoute
  useProtectedRoute(user, loading);

  useEffect(() => {
    // Initialize session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'yourapp://auth/callback',
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithOAuth = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'yourapp://auth/callback',
      },
    });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'yourapp://auth/callback',
      },
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'yourapp://auth/reset-password',
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    
    // After password update, redirect to home
    router.replace('/');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    router.replace('/(auth)/sign-in');
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithOAuth,
      signInWithMagicLink,
      resetPassword,
      updatePassword,
      signOut,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);