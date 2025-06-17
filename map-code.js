// map-code.js

mapboxgl.accessToken = 'pk.eyJ1IjoiNW00Y2s3NyIsImEiOiJjbWI4eXFqeDkwbzY1MmpwcDFzZDIwMmVqIn0.6JGe7JWhk28z5D3TLIJQwg';

let countiesGeoJSON = null;
let statesGeoJSON = null;
let mainMap = null;
let currentState = null;
let statePopup = null;

function fetchAllGeoJSON() {
  return Promise.all([
    fetch('data/county-geo.json').then(r => r.json()),
    fetch('data/us-states.geo.json').then(r => r.json())
  ]).then(([countyData, stateData]) => {
    countiesGeoJSON = countyData;
    statesGeoJSON = stateData;
  });
}

function getStateFP(stateName) {
  // Example FIPS lookup, update if you have a more complete FIPS map elsewhere
  const fipsMap = {
    "alabama":"01","alaska":"02","arizona":"04","arkansas":"05","california":"06","colorado":"08","connecticut":"09","delaware":"10",
    "florida":"12","georgia":"13","hawaii":"15","idaho":"16","illinois":"17","indiana":"18","iowa":"19","kansas":"20",
    "kentucky":"21","louisiana":"22","maine":"23","maryland":"24","massachusetts":"25","michigan":"26","minnesota":"27",
    "mississippi":"28","missouri":"29","montana":"30","nebraska":"31","nevada":"32","new hampshire":"33","new jersey":"34",
    "new mexico":"35","new york":"36","north carolina":"37","north dakota":"38","ohio":"39","oklahoma":"40","oregon":"41",
    "pennsylvania":"42","rhode island":"44","south carolina":"45","south dakota":"46","tennessee":"47","texas":"48","utah":"49",
    "vermont":"50","virginia":"51","washington":"53","west virginia":"54","wisconsin":"55","wyoming":"56","district of columbia":"11"
  };
  if (!stateName) return null;
  return fipsMap[stateName.trim().toLowerCase()] || null;
}

function updateStateGeoJSONWithStats() {
  if (!statesGeoJSON || !statesGeoJSON.features || !window.stateStats) return;
  statesGeoJSON.features.forEach(f => {
    const nameKey = Object.keys(f.properties).find(key => key.toLowerCase().includes('name')) || 'name';
    const geoName = (f.properties[nameKey] || '').trim().toLowerCase();
    const stat = getStateStats(geoName);
    if (stat) {
      f.properties = {
        ...f.properties,
        ...stat
      };
    }
  });
}

function initializeMap() {
  mainMap = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-98.5795, 39.8283],
    zoom: 3
  });

  mainMap.on('load', () => {
    updateStateGeoJSONWithStats();

    mainMap.addSource('states', { type: 'geojson', data: statesGeoJSON });
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
        'fill-opacity': 1.0
      }
    });
    mainMap.addLayer({
      id: 'states-outline',
      type: 'line',
      source: 'states',
      paint: { 'line-color': '#000000', 'line-width': 2 }
    });

    mainMap.on('mousemove', 'states-fill', (e) => {
      const p = e.features[0].properties;
      const nameKey = Object.keys(p).find(key => key.toLowerCase().includes('name')) || 'name';
      if (statePopup) statePopup.remove();
      statePopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${p[nameKey]}</strong><br/>Bush: ${p.votes_gop}<br/>Gore: ${p.votes_dem}<br/>Winner: ${p.winner}`)
        .addTo(mainMap);
    });
    mainMap.on('mouseleave', 'states-fill', () => {
      if (statePopup) statePopup.remove();
    });

    mainMap.on('click', 'states-fill', (e) => {
      const p = e.features[0].properties;
      currentState = p.state || p.name || p.NAME;
      addCountiesLayer(currentState);
    });
  });
}

function addCountiesLayer(stateName) {
  const stateFP = getStateFP(stateName);
  if (!stateFP || !countiesGeoJSON) return;
  const filtered = {
    ...countiesGeoJSON,
    features: countiesGeoJSON.features.filter(f => f.properties.STATEFP === stateFP)
  };
  filtered.features.forEach(f => {
    const fips = f.properties.GEOID;
    const stats = getCountyStats(fips);
    if (stats) {
      const total = stats.bush_votes + stats.gore_votes + stats.other_votes;
      const margin = total > 0 ? Math.abs(stats.bush_votes - stats.gore_votes) / total * 100 : 0;
      f.properties.winner = stats.winner;
      f.properties.margin = margin;
    } else {
      f.properties.winner = "Tied";
      f.properties.margin = 0;
    }
  });

  if (mainMap.getLayer('main-counties-fill')) mainMap.removeLayer('main-counties-fill');
  if (mainMap.getLayer('main-counties-outline')) mainMap.removeLayer('main-counties-outline');
  if (mainMap.getSource('main-counties')) mainMap.removeSource('main-counties');

  if (filtered.features.length > 0) {
    mainMap.addSource('main-counties', { type: 'geojson', data: filtered });
    mainMap.addLayer({
      id: 'main-counties-fill',
      type: 'fill',
      source: 'main-counties',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'winner'], 'Bush'],
          '#e74c3c',
          ['==', ['get', 'winner'], 'Gore'],
          '#3498db',
          '#b5b5b5'
        ],
        'fill-opacity': 0.85
      }
    });
    mainMap.addLayer({
      id: 'main-counties-outline',
      type: 'line',
      source: 'main-counties',
      paint: { 'line-color': '#ffffff', 'line-width': 0.5 }
    });

    let countyPopup = null;
    mainMap.on('mousemove', 'main-counties-fill', (e) => {
      mainMap.getCanvas().style.cursor = 'pointer';
      const f = e.features[0];
      const geoid = f.properties.GEOID;
      const stats = getCountyStats(geoid);
      let html = `<strong>${f.properties.NAME} County</strong>`;
      if (stats) {
        html += `<br>Bush: ${stats.bush_votes.toLocaleString()}`;
        html += `<br>Gore: ${stats.gore_votes.toLocaleString()}`;
        if (stats.other_votes > 0) html += `<br>Other: ${stats.other_votes.toLocaleString()}`;
        html += `<br>Winner: ${stats.winner}`;
      } else {
        html += `<br>No data available.`;
      }
      if (countyPopup) countyPopup.remove();
      countyPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(mainMap);
    });
    mainMap.on('mouseleave', 'main-counties-fill', () => {
      mainMap.getCanvas().style.cursor = '';
      if (countyPopup) countyPopup.remove();
      countyPopup = null;
    });
  }
}

window.initElectionMap = function () {
  Promise.all([
    fetchStateData(),
    fetchCountyData(),
    fetchAllGeoJSON()
  ]).then(() => {
    initializeMap();
  });
};

// Optional: auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.fetchStateData && window.fetchCountyData) {
    window.initElectionMap();
  }
});
