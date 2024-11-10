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

// Constants for walking calculations
const WALKING_SPEED = 1.4; // Average walking speed in meters per second (5 km/h)
const INTERSECTION_DELAY = 30; // Seconds to wait at intersections/crossings
const ELEVATION_FACTOR = 1.2; // Multiplier for uphill sections
const REST_INTERVAL = 1800; // Every 30 minutes of walking
const REST_DURATION = 300; // 5 minutes rest

function calculateWalkingDuration(
  distance: number,
  elevationGain: number = 0,
  intersections: number = 0
): number {
  // Base duration using average walking speed
  let duration = distance / WALKING_SPEED;

  // Add time for intersections
  duration += intersections * INTERSECTION_DELAY;

  // Add rest periods for long walks
  const restPeriods = Math.floor(duration / REST_INTERVAL);
  duration += restPeriods * REST_DURATION;

  // Account for elevation if available
  if (elevationGain > 0) {
    duration *= ELEVATION_FACTOR;
  }

  return Math.round(duration);
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

function estimateIntersections(steps: any[]): number {
  // Estimate number of intersections based on turn instructions
  return steps.filter(step => 
    step.maneuver?.type === 'turn' || 
    step.maneuver?.type === 'crossing' ||
    step.maneuver?.modifier === 'left' ||
    step.maneuver?.modifier === 'right' ||
    step.maneuver?.modifier === 'straight'
  ).length;
}

function processSteps(steps: any[]): RouteStep[] {
  if (!steps) return [];

  return steps.map(step => {
    const distance = step.distance;
    const intersectionCount = step.maneuver?.type === 'turn' ? 1 : 0;
    const duration = calculateWalkingDuration(distance, 0, intersectionCount);

    return {
      text: step.maneuver?.instruction || 'Continue',
      distance: distance,
      duration: duration
    };
  });
}

export const getWalkingDirections = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData> => {
  try {
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
    const steps = processSteps(route.legs?.[0]?.steps || []);
    
    // Calculate total distance and duration
    const totalDistance = route.distance;
    const intersections = estimateIntersections(route.legs?.[0]?.steps || []);
    const totalDuration = calculateWalkingDuration(totalDistance, 0, intersections);

    return {
      coordinates,
      distance: totalDistance,
      duration: totalDuration,
      steps
    };
  } catch (error) {
    console.error('Error fetching directions:', error);
    throw error;
  }
};

// Helper functions for displaying route information
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
      return `${minutes} min walk`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 
      ? `${hours}h ${remainingMinutes}min walk`
      : `${hours}h walk`;
  },

  pace: (meters: number, seconds: number): string => {
    const paceInMinutesPerKm = (seconds / 60) / (meters / 1000);
    return `${Math.round(paceInMinutesPerKm)} min/km`;
  }
};