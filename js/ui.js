import { statesGeoJSON, stateStats, countyElectionStats, getStateFP } from './data.js';
import { mainMap, currentState, removeCountiesLayer } from './map.js';

export function updateUIElements() {
  let ev_bush = 0, ev_gore = 0, total_gop_votes = 0, total_dem_votes = 0, total_votes = 0;
  statesGeoJSON.features.forEach(f => {
    const ev = f.properties.electoral_votes || 0;
    const status = f.properties.status || 'Uncalled';
    const winner = f.properties.winner || '';
    if (status === 'GOP Win' && winner === 'Bush') {
      ev_bush += ev;
    } else if (status === 'DEM Win' && winner === 'Gore') {
      ev_gore += ev;
    }
    total_gop_votes += Number(f.properties.votes_gop) || 0;
    total_dem_votes += Number(f.properties.votes_dem) || 0;
    total_votes += Number(f.properties.total_votes) || 0;
  });

  document.getElementById('bush-votes').textContent = ev_bush;
  document.getElementById('gore-votes').textContent = ev_gore;
  document.getElementById('bush-ev').textContent = ev_bush;
  document.getElementById('gore-ev').textContent = ev_gore;

  const totalEV = ev_bush + ev_gore;
  const bushEVPerc = totalEV > 0 ? (ev_bush / totalEV * 100).toFixed(1) : 0;
  const goreEVPerc = totalEV > 0 ? (ev_gore / totalEV * 100).toFixed(1) : 0;
  document.getElementById('bush-bar').style.width = bushEVPerc + "%";
  document.getElementById('gore-bar').style.width = goreEVPerc + "%";
  document.getElementById('bush-label').textContent = bushEVPerc + "%";
  document.getElementById('gore-label').textContent = goreEVPerc + "%";

  const bushProj = Math.min(ev_bush / 270, 1);
  const goreProj = Math.min(ev_gore / 270, 1);
  let projBush, projGore;
  if (ev_bush >= 270 && ev_bush > ev_gore) { projBush = 1; projGore = 0; }
  else if (ev_gore >= 270 && ev_gore > ev_bush) { projBush = 0; projGore = 1; }
  else if (bushProj + goreProj > 0) {
    projBush = bushProj / (bushProj + goreProj);
    projGore = goreProj / (bushProj + goreProj);
  } else { projBush = projGore = 0.5; }
  let angle;
  if (projBush === 1) angle = -90;
  else if (projGore === 1) angle = 90;
  else angle = -90 + 180 * projGore;
  document.getElementById('needle-group').setAttribute('transform', `rotate(${angle},250,154)`);
  document.getElementById('nyt-proj-bush-big').textContent = Math.round(projBush*100) + "%";
  document.getElementById('nyt-proj-gore-big').textContent = Math.round(projGore*100) + "%";
  document.getElementById('needle-check-bush').style.display = (projBush === 1) ? 'block' : 'none';
  document.getElementById('needle-check-gore').style.display = (projGore === 1) ? 'block' : 'none';

  const reporting_pct = Object.values(stateStats).reduce((acc, s) => acc + (s.reporting || 0), 0) / Object.keys(stateStats).length;
  document.getElementById('reporting').textContent = "Reporting: " + reporting_pct.toFixed(1) + "%";
}

export function updateStateSidebar(stateName, filtered) {
  const stateFeature = statesGeoJSON.features.find(f => {
    const nameKey = Object.keys(f.properties).find(key => key.toLowerCase().includes('name')) || 'name';
    return (f.properties[nameKey] || '').trim().toLowerCase() === stateName.trim().toLowerCase();
  });
  const electoralVotes = stateFeature ? stateFeature.properties.electoral_votes : 'N/A';
  const candidateStatsDiv = document.getElementById('candidate-stats');
  candidateStatsDiv.innerHTML = '';

  let stateGopVotes = 0, stateDemVotes = 0, stateOtherVotes = 0, stateTotalVotes = 0;
  filtered.features.forEach(c => {
    const countyFIPS = c.properties.GEOID;
    const stats = countyElectionStats[countyFIPS];
    if (stats) {
      stateGopVotes += stats.bush_votes || 0;
      stateDemVotes += stats.gore_votes || 0;
      stateOtherVotes += stats.other_votes || 0;
      stateTotalVotes += stats.bush_votes + stats.gore_votes + stats.other_votes;
    }
  });

  document.getElementById('state-sidebar-title').textContent = `President: ${stateName}`;
  document.getElementById('state-electoral-votes').textContent = `${electoralVotes} electoral votes`;

  if (stateTotalVotes > 0) {
    const bushPct = ((stateGopVotes / stateTotalVotes) * 100).toFixed(1);
    const gorePct = ((stateDemVotes / stateTotalVotes) * 100).toFixed(1);
    const otherPct = ((stateOtherVotes / stateTotalVotes) * 100).toFixed(1);
    const lead = stateGopVotes > stateDemVotes ? stateGopVotes - stateDemVotes : stateDemVotes - stateGopVotes;

    candidateStatsDiv.innerHTML = 
      `<div class="candidate-row">
        <img src="images/George-W-Bush.jpg" alt="Bush" class="candidate-image-small">
        <div class="candidate-details">
          <span style="color: #e74c3c;">George Bush</span><br>
          <span>${bushPct}%</span> <span>${stateGopVotes.toLocaleString()} votes</span>
          ${stateGopVotes > stateDemVotes ? `<span>✓ ${lead.toLocaleString()} ahead</span>` : ''}
        </div>
        <div class="bar-graph">
          <div class="bar-fill bush" style="width: ${bushPct}%"></div>
        </div>
      </div>
      <div class="candidate-row">
        <img src="images/Al_Gore.jpg" alt="Gore" class="candidate-image-small">
        <div class="candidate-details">
          <span style="color: #3498db;">Al Gore</span><br>
          <span>${gorePct}%</span> <span>${stateDemVotes.toLocaleString()} votes</span>
          ${stateDemVotes > stateGopVotes ? `<span>✓ ${lead.toLocaleString()} ahead</span>` : ''}
        </div>
        <div class="bar-graph">
          <div class="bar-fill gore" style="width: ${gorePct}%"></div>
        </div>
      </div>
      <div class="candidate-row">
        <img src="https://via.placeholder.com/40?text=?" alt="Other" class="candidate-image-small">
        <div class="candidate-details">
          <span style="color: #bbb;">Other</span><br>
          <span>${otherPct}%</span> <span>${stateOtherVotes.toLocaleString()} votes</span>
        </div>
        <div class="bar-graph">
          <div class="bar-fill other" style="width: ${otherPct}%"></div>
        </div>
      </div>
    `;
    document.getElementById('reporting-fill').style.width = '100%';
    document.getElementById('reporting-status').textContent = "Reporting: 100%";
  } else {
    candidateStatsDiv.textContent = 'No county data available';
    document.getElementById('reporting-status').textContent = '';
    document.getElementById('reporting-fill').style.width = '0%';
  }
  document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  document.getElementById('state-sidebar').style.display = 'block';
}

export function setupEventListeners() {
  document.getElementById('box-out-btn').onclick = () => {
    removeCountiesLayer();
    mainMap.flyTo({ center: [-98.5795, 39.8283], zoom: 3 });
    document.getElementById('box-out-btn').style.display = 'none';
    document.getElementById('header').style.display = 'flex';
    document.getElementById('projection-ticker-wrap').style.display = 'flex';
  };

  document.getElementById('close-sidebar-btn').onclick = () => {
    removeCountiesLayer();
  };
}
