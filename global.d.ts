/// <reference types="node" />

declare module '@env' {
    export const EXPO_PUBLIC_SUPABASE_URL: string;
    export const EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  }
  
  interface Window {
    localStorage: Storage;
  }
  
  declare var window: Window & typeof globalThis;