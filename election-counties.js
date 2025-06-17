// election-counties.js
// Loads and curates 2000 county election results from Google Sheets CSV for use on the map UI.
// USAGE: 1) Ensure PapaParse is loaded before this file.
//        2) Call loadCountyResults().then(() => { ... use window.countyResults ... });

(function(global){
  const COUNTY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1edopYcOoeeom30K3WsCmzVwvJ8rHcdYH7xB7B7QCQBI/export?format=csv';

  // Holds all county results, keyed by FIPS (e.g. "48029")
  global.countyResults = {};

  global.loadCountyResults = function() {
    return new Promise(function(resolve, reject) {
      if (!global.Papa) {
        reject("PapaParse is required before this script.");
        return;
      }
      global.Papa.parse(COUNTY_CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          const stats = {};
          results.data.forEach(function(row) {
            if (String(row.year) !== "2000" || !row.county_fips) return;
            const fips = String(row.county_fips).padStart(5, "0");
            const cand = (row.candidate || '').toLowerCase();
            if (!stats[fips]) stats[fips] = { bush: 0, gore: 0, other: 0, total: 0 };
            if (cand.includes("bush")) stats[fips].bush += +row.candidatevotes || 0;
            else if (cand.includes("gore")) stats[fips].gore += +row.candidatevotes || 0;
            else stats[fips].other += +row.candidatevotes || 0;
            stats[fips].total += +row.candidatevotes || 0;
          });
          Object.entries(stats).forEach(function([fips, val]) {
            if (val.bush > val.gore) val.winner = "Bush";
            else if (val.gore > val.bush) val.winner = "Gore";
            else val.winner = "Tied";
            val.margin = val.total > 0 ? Math.abs(val.bush - val.gore) / val.total : 0;
          });
          global.countyResults = stats;
          resolve(stats);
        },
        error: function(err) { reject(err); }
      });
    });
  };

  // Helper to get result by FIPS
  global.getCountyResult = function(fips) {
    fips = String(fips).padStart(5, "0");
    return global.countyResults && global.countyResults[fips] ? global.countyResults[fips] : null;
  };

})(window);
