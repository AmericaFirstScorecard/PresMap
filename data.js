import { updateUIElements, updateGeoJSONAndMap } from './ui.js';
import { MAPBOX_TOKEN, STATE_CSV_URL, COUNTY_CSV_URL } from './config.js';

export let countyElectionStats = {};
export let stateStats = {};
export let statesGeoJSON = null;
export let countiesGeoJSON = null;
export const stateNameToFips = {
  "alabama": "01", "alaska": "02", "arizona": "04", "arkansas": "05", "california": "06",
  "colorado": "08", "connecticut": "09", "delaware": "10", "florida": "12", "georgia": "13",
  "hawaii": "15", "idaho": "16", "illinois": "17", "indiana": "18", "iowa": "19",
  "kansas": "20", "kentucky": "21", "louisiana": "22", "maine": "23", "maryland": "24",
  "massachusetts": "25", "michigan": "26", "minnesota": "27", "mississippi": "28", "missouri": "29",
  "montana": "30", "nebraska": "31", "nevada": "32", "new hampshire": "33", "new jersey": "34",
  "new mexico": "35", "new york": "36", "north carolina": "37", "north dakota": "38", "ohio": "39",
  "oklahoma": "40", "oregon": "41", "pennsylvania": "42", "rhode island": "44", "south carolina": "45",
  "south dakota": "46", "tennessee": "47", "texas": "48", "utah": "49", "vermont": "50",
  "virginia": "51", "washington": "53", "west virginia": "54", "wisconsin": "55", "wyoming": "56",
  "district of columbia": "11", "puerto rico": "72"
};
export const stateFipsMap = { ...stateNameToFips };

export function setGeoJSON(statesData, countiesData) {
  statesGeoJSON = statesData;
  countiesGeoJSON = countiesData;
}

export function populateCountyStatsFromCSV(rows, headers) {
  const newCountyStats = {};
  for (const row of rows) {
    let fips = row.county_fips || row.CountyFIPS || row.FIPS || row.GEOID || "";
    fips = String(fips).padStart(5, "0");
    if (!/^\d{5}$/.test(fips)) continue;

    let party = (row.party || "").trim().toUpperCase();
    let votes = parseInt(row.candidatevotes || "0");
    if (!newCountyStats[fips]) {
      newCountyStats[fips] = { bush_votes: 0, gore_votes: 0, other_votes: 0, totalvotes: 0, winner: "" };
    }
    if (party === "REPUBLICAN") {
      newCountyStats[fips].bush_votes += votes;
    } else if (party === "DEMOCRAT") {
      newCountyStats[fips].gore_votes += votes;
    } else {
      newCountyStats[fips].other_votes += votes;
    }
    let tv = parseInt(row.totalvotes || "0");
    if (tv > 0) newCountyStats[fips].totalvotes = tv;
  }
  for (const fips in newCountyStats) {
    const stats = newCountyStats[fips];
    if (stats.bush_votes > stats.gore_votes) stats.winner = "Bush";
    else if (stats.gore_votes > stats.bush_votes) stats.winner = "Gore";
    else stats.winner = "Tied";
  }
  countyElectionStats = newCountyStats;
}

export function populateStateStatsFromCSV(rows) {
  const newStateStats = {};
  for (const row of rows) {
    let stateName = (row['State'] || '').trim();
    if (!stateName) continue;
    const statusKey = Object.keys(row).find(k => k.toLowerCase().includes('election status')) || 'Election status';
    let rawStatus = (row[statusKey] || 'Uncalled').trim();
    let status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
    newStateStats[stateName.toLowerCase()] = {
      state: stateName,
      electoral_votes: parseInt(row['Electoral Votes'] || 0),
      votes_gop: parseInt(row['Republican Votes'] || 0),
      votes_dem: parseInt(row['Democrat Votes'] || 0),
      votes_other: parseInt(row['Other Votes'] || 0),
      total_votes: parseInt(row['Total Votes'] || 0),
      winner: (row['Winner'] || '').trim(),
      status: status,
      gop_candidate: (row['Republican Candidate'] || 'Bush').trim(),
      dem_candidate: (row['Democrat Candidate'] || 'Gore').trim(),
      other_candidate: (row['Other Candidate'] || '').trim(),
      reporting: parseFloat(row['Reporting %'] || 0)
    };
  }
  stateStats = newStateStats;
}

export function populateStateFipsMapFromGeoJSON() {
  if (statesGeoJSON?.features?.length > 0) {
    statesGeoJSON.features.forEach(f => {
      const prop = f.properties || {};
      const nameKey = Object.keys(prop).find(k => k.toLowerCase().includes('name')) || 'name';
      const fipsKey = Object.keys(prop).find(k => k.toLowerCase().includes('statefp') || k.toLowerCase().includes('fips')) || 'STATEFP';
      const name = (prop[nameKey] || '').trim().toLowerCase();
      const fips = (prop[fipsKey] || '').toString().padStart(2, '0');
      if (name && fips && fips !== '00') stateFipsMap[name] = fips;
    });
  }
}

export async function fetchElectionData() {
  try {
    await Promise.all([
      new Promise((resolve, reject) => {
        Papa.parse(STATE_CSV_URL, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            populateStateStatsFromCSV(results.data);
            resolve();
          },
          error: function(err) {
            reject(err);
          }
        });
      }),
      new Promise((resolve, reject) => {
        fetch(COUNTY_CSV_URL)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.text();
          })
          .then(text => {
            Papa.parse(text, {
              download: false,
              header: true,
              skipEmptyLines: true,
              complete: function(results) {
                populateCountyStatsFromCSV(results.data, results.meta.fields);
                resolve();
              },
              error: function(err) {
                reject(err);
              }
            });
          })
          .catch(err => {
            reject(err);
          });
      })
    ]);
    updateGeoJSONAndMap();
  } catch (err) {
    console.error('Error during data refresh:', err);
  }
}
