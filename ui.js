import { stateStats, countyElectionStats, stateFipsMap } from './data.js';
import { mainMap, currentState } from './map.js';

export function updateGeoJSONAndMap() {
  const statusCounts = { 'GOP Win': 0, 'DEM Win': 0, 'Uncalled': 0 };
  statesGeoJSON.features.forEach(f => {
    const nameKey = Object.keys(f.properties).find(key => key.toLowerCase().includes('name')) || 'name';
    const geoName = (f.properties[nameKey] || '').trim().toLowerCase();
    const matchedRow = stateStats[geoName];
    if (matchedRow) {
      let status;
      if (matchedRow.status === 'Called' && matchedRow.winner === 'Bush') {
        status = 'GOP Win';
      } else if (matchedRow.status === 'Called' && matchedRow.winner === 'Gore') {
        status = 'DEM Win';
      } else {
        status = 'Uncalled';
      }
      f.properties = {
        ...f.properties,
        state: matchedRow.state,
        electoral_votes: matchedRow.electoral_votes,
        votes_gop: Number(matchedRow.votes_gop) || 0,
        votes_dem: Number(matchedRow.votes_dem) || 0,
        votes_other: Number(matchedRow.votes_other) || 0,
        total_votes: Number(matchedRow.total_votes) || 0,
        winner: matchedRow.winner,
        status: status,
        gop_candidate: matchedRow.gop_candidate,
        dem_candidate: matchedRow.dem_candidate,
        other_candidate: matchedRow.other_candidate,
        reporting: matchedRow.reporting
      };
      statusCounts[status]++;
    }
  });
  if (mainMap && mainMap.getSource('states')) {
    mainMap.getSource('states').setData(statesGeoJSON);
    mainMap.triggerRepaint();
  }
  updateUIElements();
}

export function updateUIElements() {
  let ev_bush = 0, ev_gore = 0;
  let national_bush_votes = 0, national_gore_votes = 0, national_total_votes = 0;

  const stateVoteTotals = {};
  for (const fips in countyElectionStats) {
    const stateFP = fips.substring(0, 2);
    const stats = countyElectionStats[fips];
    if (!stateVoteTotals[stateFP]) {
      stateVoteTotals[stateFP] = { bush_votes: 0, gore_votes: 0, total_votes: 0 };
    }
    stateVoteTotals[stateFP].bush_votes += stats.bush_votes || 0;
    stateVoteTotals[stateFP].gore_votes += stats.gore_votes || 0;
    stateVoteTotals[stateFP].total_votes += stats.totalvotes || 0;
    national_bush_votes += stats.bush_votes || 0;
    national_gore_votes += stats.gore_votes || 0;
    national_total_votes += stats.totalvotes || 0;
  }

  statesGeoJSON.features.forEach(f => {
    const stateFP = f.properties.STATEFP;
    const ev = f.properties.electoral_votes || 0;
    const status = f.properties.status || 'Uncalled';
    const winner = f.properties.winner || '';
    if (status === 'GOP Win' && winner === 'Bush') {
      ev_bush += ev;
    } else if (status === 'DEM Win' && winner === 'Gore') {
      ev_gore += ev;
    }
    if (stateVoteTotals[stateFP]) {
      f.properties.votes_gop = stateVoteTotals[stateFP].bush_votes;
      f.properties.votes_dem = stateVoteTotals[stateFP].gore_votes;
      f.properties.total_votes = stateVoteTotals[stateFP].total_votes;
    }
  });

  document.getElementById('bush-votes').textContent = ev_bush;
  document.getElementById('gore-votes').textContent = ev_gore;
  const totalEV = ev_bush + ev_gore;
  const bushEVPerc = totalEV > 0 ? (ev_bush / totalEV * 100).toFixed(1) : 0;
  const goreEVPerc = totalEV > 0 ? (ev_gore / totalEV * 100).toFixed(1) : 0;
  document.getElementById('bush-bar').style.width = bushEVPerc + "%";
  document.getElementById('gore-bar').style.width = goreEVPerc + "%";
  document.getElementById('bush-label').textContent = bushEVPerc + "%";
  document.getElementById('gore-label').textContent = goreEVPerc + "%";

  document.getElementById('bush-pop').textContent = national_bush_votes.toLocaleString();
  document.getElementById('gore-pop').textContent = national_gore_votes.toLocaleString();

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

  const reporting_pct = national_total_votes > 0 ? (national_total_votes / national_total_votes * 100).toFixed(1) : 0;
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

const arcSegs = [
  { label: "Very likely Bush", start: -90, end: -60 },
  { label: "Likely Bush", start: -60, end: -30 },
  { label: "Lean Bush", start: -30, end: -10 },
  { label: "Tossup", start: -10, end: 10 },
  { label: "Lean Gore", start: 10, end: 30 },
  { label: "Likely Gore", start: 30, end: 60 },
  { label: "Very likely Gore", start: 60, end: 90 }
];
const svgCx = 250, svgCy = 154, arcR = 110;

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", r, r, 0, arcSweep, 1, end.x, end.y
  ].join(" ");
}

function polar(cx, cy, r, angleDeg) {
  const angle = (angleDeg-90)*Math.PI/180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export function setArcSegs() {
  document.getElementById('arc-vl-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -90, -60));
  document.getElementById('arc-l-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -60, -30));
  document.getElementById('arc-le-bush').setAttribute('d', arcPath(svgCx,svgCy,arcR, -30, -10));
  document.getElementById('arc-tossup').setAttribute('d', arcPath(svgCx,svgCy,arcR, -10, 10));
  document.getElementById('arc-le-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 10, 30));
  document.getElementById('arc-l-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 30, 60));
  document.getElementById('arc-vl-gore').setAttribute('d', arcPath(svgCx,svgCy,arcR, 60, 90));
}
