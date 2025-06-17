const COUNTY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1edopYcOoeeom30K3WsCmzVwvJ8rHcdYH7xB7B7QCQBI/export?format=csv';

const ElectionCounties = {
  countyElectionStats: {},

  fetchCountyResults: function(onComplete, onError) {
    Papa.parse(COUNTY_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.processCountyCSV(results.data);
        if (typeof onComplete === 'function') onComplete(this.countyElectionStats);
      },
      error: (err) => {
        if (typeof onError === 'function') onError(err);
        else console.error('ElectionCounties error:', err);
      }
    });
  },

  processCountyCSV: function(rows) {
    this.countyElectionStats = {};
    for (const row of rows) {
      if (!row.county_fips) continue;
      const fips = String(row.county_fips).padStart(5, '0');
      this.countyElectionStats[fips] = {
        bush_votes: Number(row.bush_votes) || 0,
        gore_votes: Number(row.gore_votes) || 0,
        other_votes: Number(row.other_votes) || 0,
        totalvotes: Number(row.totalvotes) || 0,
        winner:
          Number(row.bush_votes) > Number(row.gore_votes)
            ? 'Bush'
            : Number(row.gore_votes) > Number(row.bush_votes)
            ? 'Gore'
            : 'Tied',
      };
    }
  },

  // Lookup function for map: returns stats by 5-digit FIPS code
  getStats: function(fips) {
    const key = String(fips).padStart(5, '0');
    return this.countyElectionStats[key] || null;
  }
};
