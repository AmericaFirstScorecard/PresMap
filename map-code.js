mapboxgl.accessToken = 'pk.eyJ1IjoiNW00Y2s3NyIsImEiOiJjbWI4eXFqeDkwbzY1MmpwcDFzZDIwMmVqIn0.6JGe7JWhk28z5D3TLIJQwg';

let mainMap = null;
let statesGeoJSON = null;
let countiesGeoJSON = null;

// Utility: Get state FIPS code map
function buildStateFipsMap(statesGeoJSON) {
  const fipsMap = {};
  statesGeoJSON.features.forEach(f => {
    const props = f.properties;
    const nameKey = Object.keys(props).find(k => k.toLowerCase().includes('name')) || 'name';
    const fipsKey = Object.keys(props).find(k => k.toLowerCase().includes('statefp') || k.toLowerCase().includes('fips')) || 'STATEFP';
    fipsMap[(props[nameKey] || '').trim().toLowerCase()] = String(props[fipsKey]).padStart(2, '0');
  });
  return fipsMap;
}
let stateFipsMap = {};

// 1. Fetch all GeoJSON and data first, then build map!
Promise.all([
  fetch('data/us-states.geo.json').then(r => r.json()),
  fetch('data/county-geo.json').then(r => r.json())
]).then(([statesJson, countiesJson]) => {
  statesGeoJSON = statesJson;
  countiesGeoJSON = countiesJson;
  stateFipsMap = buildStateFipsMap(statesGeoJSON);

  // Now wait for both state and county results to be ready
  ElectionState.fetchStateResults(() => {
    ElectionCounties.fetchCountyResults(() => {
      initMap(); // all data ready, build map!
    });
  });
});

function initMap() {
  mainMap = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-98.6, 39.8],
    zoom: 3,
  });

  mainMap.on('load', () => {
    // --- STATE LAYER ---
    mainMap.addSource('states', { type: 'geojson', data: colorStatesGeo(statesGeoJSON) });
    mainMap.addLayer({
      id: 'states-fill',
      type: 'fill',
      source: 'states',
      paint: {
        'fill-color': [
          'match', ['get', 'winner'],
          'Bush', '#d12c0f',
          'Gore', '#0e47e6',
          /* other */ '#cccccc'
        ],
        'fill-opacity': 0.92
      }
    });
    mainMap.addLayer({
      id: 'states-outline',
      type: 'line',
      source: 'states',
      paint: { 'line-color': '#222', 'line-width': 1.5 }
    });

    // --- COUNTY LAYER (initially off, toggled on click) ---
    mainMap.addSource('counties', { type: 'geojson', data: {type:'FeatureCollection', features:[]} });
    mainMap.addLayer({
      id: 'counties-fill',
      type: 'fill',
      source: 'counties',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'match', ['get', 'winner'],
          'Bush', '#f2b0a9',
          'Gore', '#a8c7ee',
          /* other */ '#bbbbbb'
        ],
        'fill-opacity': 0.80
      }
    });
    mainMap.addLayer({
      id: 'counties-outline',
      type: 'line',
      source: 'counties',
      layout: { visibility: 'none' },
      paint: { 'line-color': '#fff', 'line-width': 0.3 }
    });

    // --- State Hover Popup ---
    let popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    mainMap.on('mousemove', 'states-fill', (e) => {
      mainMap.getCanvas().style.cursor = 'pointer';
      const props = e.features[0].properties;
      const stateName = (props.name || props.NAME || props.state || '').trim();
      const stats = ElectionState.getStats(stateName);
      popup.setLngLat(e.lngLat)
        .setHTML(`
          <strong>${stateName}</strong><br>
          GOP: ${stats?.votes_gop?.toLocaleString() || 0}<br>
          DEM: ${stats?.votes_dem?.toLocaleString() || 0}<br>
          Winner: ${stats?.winner || 'Uncalled'}
        `)
        .addTo(mainMap);
    });
    mainMap.on('mouseleave', 'states-fill', () => {
      mainMap.getCanvas().style.cursor = '';
      popup.remove();
    });

    // --- State Click: Show County Layer for that State ---
    mainMap.on('click', 'states-fill', (e) => {
      const props = e.features[0].properties;
      const stateName = (props.name || props.NAME || props.state || '').trim();
      showCountiesForState(stateName);
    });

    // --- County Hover Popup ---
    let countyPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
    mainMap.on('mousemove', 'counties-fill', (e) => {
      mainMap.getCanvas().style.cursor = 'pointer';
      const props = e.features[0].properties;
      const stats = ElectionCounties.getStats(props.GEOID);
      countyPopup.setLngLat(e.lngLat)
        .setHTML(`
          <strong>${props.NAME} County</strong><br>
          Bush: ${stats?.bush_votes?.toLocaleString() || 0}<br>
          Gore: ${stats?.gore_votes?.toLocaleString() || 0}<br>
          Other: ${stats?.other_votes?.toLocaleString() || 0}<br>
          Winner: ${stats?.winner || 'Tied'}
        `)
        .addTo(mainMap);
    });
    mainMap.on('mouseleave', 'counties-fill', () => {
      mainMap.getCanvas().style.cursor = '';
      countyPopup.remove();
    });

    // Optional: Add a reset/box out button logic here to go back to states
    // E.g., document.getElementById('box-out-btn').onclick = hideCounties;

  });
}

// --- Helper to color and update state features from ElectionState ---
function colorStatesGeo(statesGeo) {
  return {
    ...statesGeo,
    features: statesGeo.features.map(f => {
      const props = f.properties;
      const stateName = (props.name || props.NAME || props.state || '').trim();
      const stats = ElectionState.getStats(stateName);
      return {
        ...f,
        properties: {
          ...props,
          winner: stats?.winner || 'Uncalled',
        }
      };
    })
  };
}

// --- Show counties for a selected state, color by winner, zoom in ---
function showCountiesForState(stateName) {
  // Get FIPS code for this state
  const stateFP = stateFipsMap[stateName.trim().toLowerCase()];
  // Filter county GeoJSON for that state
  const filtered = {
    ...countiesGeoJSON,
    features: countiesGeoJSON.features.filter(f => f.properties.STATEFP === stateFP).map(f => {
      const stats = ElectionCounties.getStats(f.properties.GEOID);
      return {
        ...f,
        properties: {
          ...f.properties,
          winner: stats?.winner || 'Tied',
        }
      };
    })
  };
  // Update county source and layer visibility
  mainMap.getSource('counties').setData(filtered);
  mainMap.setLayoutProperty('counties-fill', 'visibility', 'visible');
  mainMap.setLayoutProperty('counties-outline', 'visibility', 'visible');

  // Optionally hide states layer for clarity
  // mainMap.setLayoutProperty('states-fill', 'visibility', 'none');
  // mainMap.setLayoutProperty('states-outline', 'visibility', 'none');

  // Zoom to the selected state
  const stateFeature = statesGeoJSON.features.find(f => {
    const props = f.properties;
    const n = (props.name || props.NAME || props.state || '').trim();
    return n.toLowerCase() === stateName.trim().toLowerCase();
  });
  if (stateFeature) {
    const bbox = turf.bbox(stateFeature); // turf.js required!
    mainMap.fitBounds(bbox, { padding: 40, duration: 1100 });
  }
}

// --- Hide counties and reset to nationwide state view (call on "Box Out" click, etc.) ---
function hideCounties() {
  mainMap.setLayoutProperty('counties-fill', 'visibility', 'none');
  mainMap.setLayoutProperty('counties-outline', 'visibility', 'none');
  // mainMap.setLayoutProperty('states-fill', 'visibility', 'visible');
  // mainMap.setLayoutProperty('states-outline', 'visibility', 'visible');
  mainMap.flyTo({ center: [-98.6, 39.8], zoom: 3 });
}
