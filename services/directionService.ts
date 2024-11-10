// src/services/directionsService.ts

const ORS_API_KEY = '5b3ce3597851110001cf62481f13a7b4f2bd44f68b6b33b28a0c55a0'; 

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

export const getWalkingDirections = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData> => {
  try {
    const response = await fetch(
      'https://api.openrouteservice.org/v2/directions/foot-walking',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': ORS_API_KEY
        },
        body: JSON.stringify({
          coordinates: [
            [startLng, startLat],
            [endLng, endLat]
          ],
          instructions: true,
          format: 'geojson'
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch directions');
    }

    const data = await response.json();
    const route = data.features[0];

    return {
      coordinates: route.geometry.coordinates.map(([lng, lat]: number[]) => ({
        latitude: lat,
        longitude: lng
      })),
      distance: route.properties.segments[0].distance,
      duration: route.properties.segments[0].duration,
      steps: route.properties.segments[0].steps.map((step: any) => ({
        text: step.instruction,
        distance: step.distance,
        duration: step.duration
      }))
    };
  } catch (error) {
    console.error('Error fetching directions:', error);
    throw error;
  }
};