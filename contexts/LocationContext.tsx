import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useLocation } from '../hooks/useLocation';
import * as Location from 'expo-location';

interface LocationContextType {
  location: Location.LocationObject | null;
  errorMsg: string | null;
  isLoading: boolean;
  checkAndRequestLocationPermissions: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const locationData = useLocation();

  // Request permissions when the provider is mounted
  useEffect(() => {
    locationData.checkAndRequestLocationPermissions();
  }, []);

  return (
    <LocationContext.Provider value={locationData}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
