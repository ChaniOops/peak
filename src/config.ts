/** Map fallback centre before the first GPS fix, and the loop used by the simulator. */
export const CAMPUS = {
  name: 'Campus',
  // Placeholder (Guwahati). Set to the real campus before the demo.
  center: { lat: 26.1878, lng: 91.6916 },
}

/**
 * CARTO Dark Matter (free vector tiles, no API key; © CARTO, © OpenStreetMap):
 * the crisp dark street map from the mapcn Store Locator reference.
 */
export const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
