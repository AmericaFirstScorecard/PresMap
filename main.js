import { fetchElectionData, setGeoJSON, populateStateFipsMapFromGeoJSON } from './data.js';
import { initializeMainMap, addCountiesLayer, removeCountiesLayer, getStateBounds, disableStateHover } from './map.js';
import { setArcSegs } from './ui.js';
import { MAPBOX_TOKEN } from './config.js';

mapboxgl.accessToken = MAPBOX_TOKEN;

async function init() {
  // Fetch GeoJSON data
  const [countiesData, statesData] = await Promise.all([
    fetch('data/county-geo.json').then(r => r.json()),
    fetch('data/us-states.geo.json').then(r => r.json())
  ]);
  setGeoJSON(statesData, countiesData);
  populateStateFipsMapFromGeoJSON();

  // Initialize UI and map
  setArcSegs();
  await fetchElectionData();
  initializeMainMap(handleStateClick);

  // Set up periodic data refresh
  setInterval(fetchElectionData, 60000);
}

function handleStateClick(stateName, lngLat) {
  currentState = stateName;
  addCountiesLayer(stateName);
  const bounds = getStateBounds(stateName);
  if (bounds) {
    mainMap.fitBounds(bounds, { padding: 40, duration: 1100 });
  } else {
    mainMap.flyTo({ center: lngLat, zoom: 6 });
  }
  document.getElementById('header').style.display = 'none';
  document.getElementById('box-out-btn').style.display = 'block';
  document.getElementById('projection-ticker-wrap').style.display = 'none';
  disableStateHover();
}

document.getElementById('box-out-btn').onclick = () => {
  removeCountiesLayer();
  mainMap.flyTo({ center: [-98.5795, 39.8283], zoom: 3 });
  document.getElementById('box-out-btn').style.display = 'none';
  document.getElementById('header').style.display = 'flex';
  document.getElementById('projection-ticker-wrap').style.display = 'flex';
};

document.getElementById('close-sidebar-btn').onclick = () => {
  removeCountiesLayer();
  mainMap.flyTo({ center: [-98.5795, 39.8283], zoom: 3 });
};

init().catch(err => console.error('Initialization error:', err));
