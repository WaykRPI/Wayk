// src/services/directionsService.ts

interface RouteStep {
  text: string;
  distance: number;
  duration: number;
}

export interface RouteData {
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  distance: number;
  duration: number;
  steps: RouteStep[];
}

function decodePolyline(str: string, precision = 5) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  let shift = 0;
  let result = 0;
  let byte = null;
  let latitude_change;
  let longitude_change;
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push({
      latitude: lat / factor,
      longitude: lng / factor
    });
  }

  return coordinates;
}

function generateSteps(route: any): RouteStep[] {
  if (!route.legs?.[0]?.steps) return [];

  return route.legs[0].steps.map((step: any) => ({
    text: step.maneuver.instruction,
    distance: step.distance,
    duration: step.duration
  }));
}

export const getWalkingDirections = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData> => {
  try {
    // Using OSRM backend
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch directions');
    }

    const data = await response.json();

    if (!data.routes?.[0]) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const coordinates = decodePolyline(route.geometry);

    return {
      coordinates,
      distance: route.distance, // in meters
      duration: route.duration, // in seconds
      steps: route.legs?.[0]?.steps?.map((step: any) => ({
        text: step.maneuver?.instruction || 'Continue',
        distance: step.distance,
        duration: step.duration
      })) || []
    };
  } catch (error) {
    console.error('Error fetching directions:', error);
    throw error;
  }
};

// Optional: Helper function to format distance and duration for display
export const formatRouteInfo = {
  distance: (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  },
  
  duration: (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }
};