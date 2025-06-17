const STATE_CSV_URL = 'https://docs.google.com/spreadsheets/d/10zbHap425MtnS4jgsELt__DhtEQbXI8GlnD-6vkB4yg/export?format=csv';

const ElectionState = {
  stateStats: {},

  fetchStateResults: function(onComplete, onError) {
    Papa.parse(STATE_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        this.processStateCSV(results.data);
        if (typeof onComplete === 'function') onComplete(this.stateStats);
      },
      error: (err) => {
        if (typeof onError === 'function') onError(err);
        else console.error('ElectionState error:', err);
      }
    });
  },

  processStateCSV: function(rows) {
    this.stateStats = {};
    for (const row of rows) {
      let stateName = (row['State'] || '').trim();
      if (!stateName) continue;
      // Find the Election status column dynamically
      const statusKey = Object.keys(row).find(k => k.toLowerCase().includes('election status')) || 'Election status';
      let rawStatus = (row[statusKey] || 'Uncalled').trim();
      let status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

      this.stateStats[stateName.toLowerCase()] = {
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
  },

  // Lookup by normalized state name (case-insensitive)
  getStats: function(stateName) {
    if (!stateName) return null;
    return this.stateStats[stateName.trim().toLowerCase()] || null;
  }
};
