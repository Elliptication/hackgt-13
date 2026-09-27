/**
 * Shared basemap config, used by the main map and the contribute location picker.
 *
 * OpenStreetMap's own raster tiles: free, no API key, and sharp all the way to
 * z19 - which matters, because doorways and curb ramps only become visible at
 * the zoom levels where a blurry upscaled tile is useless.
 *
 * The standard style is dense and colourful, and our data would disappear into
 * it. Rather than trade sharpness for calm by moving to a "light" basemap that
 * stops rendering at z16, we desaturate these tiles in CSS - see
 * `.leaflet-tile-pane` in styles/globals.css. Sharp *and* quiet.
 *
 * Do NOT switch to CARTO (basemaps.cartocdn.com). Every path there now requires
 * an API key and serves a 2KB "API KEY REQUIRED" watermark at HTTP 200, so it
 * fails silently and looks like a bug in our code.
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** OSM renders its standard layer to z19, and so do we - no upscaling, no blur. */
export const MAX_ZOOM = 19
