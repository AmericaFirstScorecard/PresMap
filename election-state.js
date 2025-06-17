// election-state.js

// URL for the state election results CSV
const STATE_CSV_URL = 'https://docs.google.com/spreadsheets/d/10zbHap425MtnS4jgsELt__DhtEQbXI8GlnD-6vkB4yg/export?format=csv';

// Internal lookup table for state stats
let stateStats = {};

/**
 * Fetches and parses the state data CSV, populates stateStats.
 * Returns a Promise that resolves when data is ready.
 */
function fetchStateData() {
  return new Promise((resolve, reject) => {
    Papa.parse(STATE_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const stats = {};
        for (const row of results.data) {
          const stateName = (row['State'] || '').trim();
          if (!stateName) continue;

          const statusKey = Object.keys(row)
            .find(k => k.toLowerCase().includes('election status')) || 'Election status';

          const rawStatus = (row[statusKey] || 'Uncalled').trim();
          const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

          stats[stateName.toLowerCase()] = {
            state: stateName,
            electoral_votes: parseInt(row['Electoral Votes']) || 0,
            votes_gop: parseInt(row['Republican Votes']) || 0,
            votes_dem: parseInt(row['Democrat Votes']) || 0,
            votes_other: parseInt(row['Other Votes']) || 0,
            total_votes: parseInt(row['Total Votes']) || 0,
            winner: (row['Winner'] || '').trim(),
            status: status,
            gop_candidate: (row['Republican Candidate'] || 'Bush').trim(),
            dem_candidate: (row['Democrat Candidate'] || 'Gore').trim(),
            other_candidate: (row['Other Candidate'] || '').trim(),
            reporting: parseFloat(row['Reporting %']) || 0
          };
        }
        stateStats = stats;
        resolve();
      },
      error: (err) => {
        console.error("Error parsing state CSV:", err);
        reject(err);
      }
    });
  });
}

/**
 * Helper to get stats by state name, case-insensitive.
 * Example:
 *   getStateStats('Texas') → { votes_gop: ..., votes_dem: ..., winner: ... }
 */
function getStateStats(name) {
  if (!name) return null;
  return stateStats[name.trim().toLowerCase()] || null;
}

// Expose to global namespace
window.fetchStateData = fetchStateData;
window.getStateStats = getStateStats;
window.stateStats = stateStats;

// Automatically fetch state data on load
// You can await fetchStateData() before initializing map logic in map-code.js
fetchStateData().then(() => {
  console.log("✅ State data loaded for", Object.keys(stateStats).length, "states.");
}).catch(err => {
  console.warn("⚠️ Could not load state election data:", err);
});
