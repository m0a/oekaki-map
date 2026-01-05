declare module 'leaflet-image' {
  import type * as L from 'leaflet';

  type LeafletImageCallback = (error: Error | null, canvas: HTMLCanvasElement) => void;

  function leafletImage(map: L.Map, callback: LeafletImageCallback): void;

  export default leafletImage;
}
