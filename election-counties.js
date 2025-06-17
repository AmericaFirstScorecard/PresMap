// election-counties.js

// Google Sheets CSV export link for county-level results
const COUNTY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1edopYcOoeeom30K3WsCmzVwvJ8rHcdYH7xB7B7QCQBI/export?format=csv';

// Lookup table: FIPS code → stats object
let countyElectionStats = {};

/**
 * Fetches and parses the county data CSV, populates countyElectionStats.
 * Returns a Promise that resolves when data is ready.
 */
function fetchCountyData() {
  return new Promise((resolve, reject) => {
    Papa.parse(COUNTY_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const stats = {};
        for (const row of results.data) {
          // Normalize FIPS
          const fips = String(row.county_fips || row.FIPS || row.fips || '').padStart(5, "0");
          if (!/^\d{5}$/.test(fips)) continue;

          // Support for different header formats
          const bushVotes = parseInt(row.bush_votes || row.Bush_Votes || row['Bush Votes'] || row.Republican_Votes || row['Republican Votes'] || 0);
          const goreVotes = parseInt(row.gore_votes || row.Gore_Votes || row['Gore Votes'] || row.Democrat_Votes || row['Democrat Votes'] || 0);
          const otherVotes = parseInt(row.other_votes || row.Other_Votes || row['Other Votes'] || 0);

          // Fallback to candidate-based parsing if sheet is candidate-split
          let bVotes = bushVotes, gVotes = goreVotes, oVotes = otherVotes;
          if (typeof row.candidate === 'string' && row.candidatevotes) {
            const candidate = row.candidate.toLowerCase();
            const candidateVotes = parseInt(row.candidatevotes) || 0;
            if (candidate.includes("bush")) bVotes = candidateVotes;
            else if (candidate.includes("gore")) gVotes = candidateVotes;
            else oVotes = candidateVotes;
          }

          stats[fips] = {
            bush_votes: bVotes || 0,
            gore_votes: gVotes || 0,
            other_votes: oVotes || 0,
            total_votes: (bVotes || 0) + (gVotes || 0) + (oVotes || 0),
            county: row.county || row.County || "",
            state: row.state || row.State || ""
          };

          // Winner logic
          if (bVotes > gVotes) stats[fips].winner = "Bush";
          else if (gVotes > bVotes) stats[fips].winner = "Gore";
          else stats[fips].winner = "Tied";
        }
        countyElectionStats = stats;
        resolve();
      },
      error: (err) => {
        console.error("Error parsing county CSV:", err);
        reject(err);
      }
    });
  });
}

/**
 * Helper to get county stats by FIPS code (string or number).
 * Example: getCountyStats('48113')
 */
function getCountyStats(fips) {
  if (!fips) return null;
  const key = String(fips).padStart(5, "0");
  return countyElectionStats[key] || null;
}

// Expose to global namespace
window.fetchCountyData = fetchCountyData;
window.getCountyStats = getCountyStats;
window.countyElectionStats = countyElectionStats;

// Automatically fetch county data on load
fetchCountyData().then(() => {
  console.log("✅ County data loaded for", Object.keys(countyElectionStats).length, "counties.");
}).catch(err => {
  console.warn("⚠️ Could not load county election data:", err);
});
