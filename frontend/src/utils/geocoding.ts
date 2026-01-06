import type { ReverseGeocodeResult, NominatimAddress } from '../types/index';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'OekakiMap/1.0 (https://github.com/m0a/oekaki-map)';

interface NominatimResponse {
  display_name: string;
  address?: NominatimAddress;
  error?: string;
}

function extractPlaceName(address: NominatimAddress | undefined): string {
  if (!address) return '地図';
  const locality =
    address.city || address.town || address.village || address.suburb;
  if (locality) {
    return locality;
  }
  if (address.state) {
    return address.state;
  }
  return '地図';
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult | null> {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lng.toString());
  url.searchParams.set('format', 'json');
  url.searchParams.set('accept-language', 'ja');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '14');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
      ...(signal && { signal }),
    });

    if (!response.ok) {
      console.warn(`Nominatim returned status ${response.status}`);
      return null;
    }

    const data: NominatimResponse = await response.json();

    if (data.error) {
      console.warn('Nominatim error:', data.error);
      return null;
    }

    const placeName = extractPlaceName(data.address);

    return {
      placeName,
      address: data.address || {},
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Reverse geocoding failed:', error);
    return null;
  }
}

export function getLocationLabel(
  result: ReverseGeocodeResult | null,
  lat: number,
  lng: number
): string {
  if (result?.placeName && result.placeName !== '地図') {
    return result.placeName;
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}付近`;
}
