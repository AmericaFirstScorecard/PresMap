import { initializeMap, addCountiesLayer, removeCountiesLayer } from './map.js';
import { refreshElectionData, stateFipsMap } from './data.js';
import { setupEventListeners } from './ui.js';
import { setArcSegments } from './needle.js';

// Configuration
mapboxgl.accessToken = 'pk.eyJ1IjoiNW00Y2s3NyIsImEiOiJjbWI4eXFqeDkwbzY1MmpwcDFzZDIwMmVqIn0.6JGe7JWhk28z5D3TLIJQwg';
const STATE_CSV_URL = 'https://docs.google.com/spreadsheets/d/10zbHap425MtnS4jgsELt__DhtEQbXI8GlnD-6vkB4yg/export?format=csv';
const COUNTY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1edopYcOoeeom30K3WsCmzVwvJ8rHcdYH7xB7B7QCQBI/export?format=csv';

// Initialize application
async function init() {
  try {
    // Load initial data
    await Promise.all([
      fetch('data/county-geo.json').then(r => r.json()).then(data => { window.countiesGeoJSON = data; }),
      fetch('data/us-states.geo.json').then(r => r.json()).then(data => { 
        window.statesGeoJSON = data; 
        Object.entries(stateFipsMap).forEach(([name, fips]) => {
          window.stateFipsMap[name] = fips;
        });
      }),
    ]);

    // Set up needle SVG
    setArcSegments();

    // Initialize map
    initializeMap();

    // Refresh election data
    await refreshElectionData();

    // Set up event listeners
    setupEventListeners();

    // Periodically refresh data
    setInterval(refreshElectionData, 60000);
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

init();
