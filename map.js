import { stateFipsMap, stateStats, countyElectionStats, statesGeoJSON, countiesGeoJSON } from './data.js';
import { updateStateSidebar } from './ui.js';

export let mainMap = null;
export let statePopup = null;
export let stateHoverHandlers = { mousemove: null, mouseleave: null };
export let currentState = null;

export function initializeMainMap(handleStateClick) {
  mainMap = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-98.5795, 39.8283],
    zoom: 3
  });

  mainMap.on('load', () => {
    if (!statesGeoJSON || !statesGeoJSON.features) {
      const stateFeatures = {};
      countiesGeoJSON.features.forEach(f => {
        const stateFP = f.properties.STATEFP;
        if (!stateFeatures[stateFP]) {
          stateFeatures[stateFP] = {
            type: "Feature",
            properties: { STATEFP: stateFP, name: Object.keys(stateFipsMap).find(key => stateFipsMap[key] === stateFP) || `State ${stateFP}` },
            geometry: { type: "MultiPolygon", coordinates: [] }
          };
        }
        if (f.geometry.type === "Polygon") {
          stateFeatures[stateFP].geometry.coordinates.push(f.geometry.coordinates);
        } else if (f.geometry.type === "MultiPolygon") {
          stateFeatures[stateFP].geometry.coordinates.push(...f.geometry.coordinates);
        }
      });
      statesGeoJSON = { type: "FeatureCollection", features: Object.values(stateFeatures) };
    }

    mainMap.addSource('states', { type: 'geojson', data: statesGeoJSON });
    mainMap.addLayer({
      id: 'states-fill',
      type: 'fill',
      source: 'states',
      paint: {
        'fill-color': [
          'match', ['get', 'status'],
          'GOP Win', '#d12c0f',
          'DEM Win', '#0e47e6',
          'Uncalled', [
            'case',
            ['>', ['to-number', ['get', 'votes_gop'], 0], ['to-number', ['get', 'votes_dem'], 0]], '#f4a6a6',
            ['>', ['to-number', ['get', 'votes_dem'], 0], ['to-number', ['get', 'votes_gop'], 0]], '#a6c8f4',
            '#cccccc'
          ],
          '#ffffff'
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

    enableStateHover();
    mainMap.on('click', 'states-fill', (e) => {
      const p = e.features[0].properties;
      const nameKey = Object.keys(p).find(key => key.toLowerCase().includes('name')) || 'name';
      const stateName = p[nameKey];
      if (!stateName) return;
      handleStateClick(stateName, e.lngLat);
    });
  });
}

export function enableStateHover() {
  if (!mainMap || !mainMap.getLayer('states-fill')) return;
  if (stateHoverHandlers.mousemove) return;
  stateHoverHandlers.mousemove = function(e) {
    const p = e.features[0].properties;
    const nameKey = Object.keys(p).find(key => key.toLowerCase().includes('name')) || 'name';
    const gop = +p.votes_gop || 0, dem = +p.votes_dem || 0, total = gop + dem + (+p.votes_other || 0);
    const gopPerc = total > 0 ? ((gop / total) * 100).toFixed(1) : 0;
    const demPerc = total > 0 ? ((dem / total) * 100).toFixed(1) : 0;
    const winner = p.winner || 'Uncalled';
    const gopName = p.gop_candidate || 'Bush';
    const demName = p.dem_candidate || 'Gore';
    const gopCheck = winner === gopName && p.status !== 'Uncalled' ? '✓ ' : '';
    const demCheck = winner === demName && p.status !== 'Uncalled' ? '✓ ' : '';
    if (statePopup) statePopup.remove();
    statePopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
      .setLngLat(e.lngLat)
      .setHTML(
        `<strong>${p[nameKey]}</strong><br/>
        <b>Electoral Votes:</b> ${p.electoral_votes || 'N/A'}<br/>
        <b>Reporting:</b> ${p.reporting || 0}%<br/>
        <b style="color:#d12c0f;">${gopCheck}${gopName}:</b> ${gop.toLocaleString()} (${gopPerc}%)<br/>
        <b style="color:#0e47e6;">${demCheck}${demName}:</b> ${dem.toLocaleString()} (${demPerc}%)<br/>
        <b>Winner:</b> ${p.status === 'Uncalled' ? 'Uncalled' : winner}`
      )
      .addTo(mainMap);
  };
  stateHoverHandlers.mouseleave = function() { if (statePopup) statePopup.remove(); };
  mainMap.on('mousemove', 'states-fill', stateHoverHandlers.mousemove);
  mainMap.on('mouseleave', 'states-fill', stateHoverHandlers.mouseleave);
}

export function disableStateHover() {
  if (!mainMap || !mainMap.getLayer('states-fill')) return;
  if (stateHoverHandlers.mousemove)
    mainMap.off('mousemove', 'states-fill', stateHoverHandlers.mousemove);
  if (stateHoverHandlers.mouseleave)
    mainMap.off('mouseleave', 'states-fill', stateHoverHandlers.mouseleave);
  stateHoverHandlers.mousemove = null;
  stateHoverHandlers.mouseleave = null;
  if (statePopup) statePopup.remove();
}

export function getStateBounds(stateName) {
  const stateFP = getStateFP(stateName);
  if (!stateFP) return null;
  const stateFeature = statesGeoJSON.features.find(f => {
    const nameKey = Object.keys(f.properties).find(key => key.toLowerCase().includes('name')) || 'name';
    return (f.properties[nameKey] || '').trim().toLowerCase() === stateName.trim().toLowerCase();
  });
  if (!stateFeature) return null;
  let coords = [];
  if (stateFeature.geometry.type === "Polygon") {
    coords = stateFeature.geometry.coordinates[0];
  } else if (stateFeature.geometry.type === "MultiPolygon") {
    coords = stateFeature.geometry.coordinates.flat(2);
  }
  if (!coords.length) return null;
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  coords.forEach(coord => {
    if (Array.isArray(coord) && coord.length >= 2) {
      minLng = Math.min(minLng, coord[0]);
      maxLng = Math.max(maxLng, coord[0]);
      minLat = Math.min(minLat, coord[1]);
      maxLat = Math.max(maxLat, coord[1]);
    }
  });
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function addCountiesLayer(stateName) {
  const stateFP = getStateFP(stateName);
  if (!stateFP) return;
  const filtered = {
    ...countiesGeoJSON,
    features: countiesGeoJSON.features.filter(f => f.properties.STATEFP === stateFP)
  };
  if (Object.keys(countyElectionStats).length === 0) {
    // No county stats yet, skip color
  }
  filtered.features.forEach(f => {
    const fips = f.properties.GEOID;
    const stats = countyElectionStats[fips];
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
          ['interpolate', ['linear'], ['get', 'margin'],
            0, '#f4a6a6',
            10, '#e74c3c',
            20, '#d12c0f'
          ],
          ['==', ['get', 'winner'], 'Gore'],
          ['interpolate', ['linear'], ['get', 'margin'],
            0, '#a6c8f4',
            10, '#3498db',
            20, '#0e47e6'
          ],
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
      const stats = countyElectionStats[geoid];
      let html = `<strong>${f.properties.NAME} County</strong>`;
      if (stats) {
        html += `<br>Bush: ${stats.bush_votes.toLocaleString()}`;
        html += `<br>Gore: ${stats.gore_votes.toLocaleString()}`;
        if (stats.other_votes > 0) html += `<br>Other: ${stats.other_votes.toLocaleString()}`;
        html += `<br>Winner: <b style="color:${stats.winner==='Bush'?'#e74c3c':'#3498db'}">${stats.winner}${(stats.winner==='Bush'||stats.winner==='Gore')?checkmarkSvg(stats.winner==='Bush'?'#e74c3c':'#3498db',18):''}</b>`;
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

  updateStateSidebar(stateName, filtered);
}

export function removeCountiesLayer() {
  if (mainMap.getLayer('main-counties-fill')) mainMap.removeLayer('main-counties-fill');
  if (mainMap.getLayer('main-counties-outline')) mainMap.removeLayer('main-counties-outline');
  if (mainMap.getSource('main-counties')) mainMap.removeSource('main-counties');
  document.getElementById('state-sidebar').style.display = 'none';
  document.getElementById('header').style.display = 'flex';
  document.getElementById('projection-ticker-wrap').style.display = 'flex';
  enableStateHover();
  currentState = null;
}

function getStateFP(stateName) {
  if (!stateName) return null;
  return stateFipsMap[stateName.trim().toLowerCase()] || null;
}

function checkmarkSvg(color = "#fff", size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;">
    <circle cx="12" cy="12" r="12" fill="${color}" opacity="0.6"/>
    <polyline points="7,13 11,17 17,8" fill="none" stroke="#fff" stroke-width="2"/>
  </svg>`;
}
