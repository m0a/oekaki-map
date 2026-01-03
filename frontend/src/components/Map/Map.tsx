import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition } from '../../types';

interface MapProps {
  position?: MapPosition;
  onPositionChange?: (position: MapPosition) => void;
  interactive?: boolean;
}

// Default position: Tokyo, Japan
const DEFAULT_POSITION: MapPosition = {
  lat: 35.6812,
  lng: 139.7671,
  zoom: 14,
};

export function Map({
  position = DEFAULT_POSITION,
  onPositionChange,
  interactive = true,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [position.lat, position.lng],
      zoom: position.zoom,
      zoomControl: true,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Listen for map movements
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onPositionChange?.({
        lat: center.lat,
        lng: center.lng,
        zoom,
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map when position changes externally
  useEffect(() => {
    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    // Only update if position actually changed
    if (
      currentCenter.lat !== position.lat ||
      currentCenter.lng !== position.lng ||
      currentZoom !== position.zoom
    ) {
      mapRef.current.setView([position.lat, position.lng], position.zoom, {
        animate: false,
      });
    }
  }, [position.lat, position.lng, position.zoom]);

  // Update interactivity
  useEffect(() => {
    if (!mapRef.current) return;

    if (interactive) {
      mapRef.current.dragging.enable();
      mapRef.current.touchZoom.enable();
      mapRef.current.scrollWheelZoom.enable();
      mapRef.current.doubleClickZoom.enable();
    } else {
      mapRef.current.dragging.disable();
      mapRef.current.touchZoom.disable();
      mapRef.current.scrollWheelZoom.disable();
      mapRef.current.doubleClickZoom.disable();
    }
  }, [interactive]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        filter: 'grayscale(100%)', // Constitution: grayscale for visibility
      }}
    />
  );
}

export { DEFAULT_POSITION };
