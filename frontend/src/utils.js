export function parseCSV(txt) {
  const lines = txt.trim().split('\n');
  if (lines.length < 2) return [];
  const parseRow = (line) => {
    const res = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { res.push(cur); cur = ''; }
      else cur += ch;
    }
    res.push(cur); return res;
  };
  const hdrs = parseRow(lines[0]);
  return lines.slice(1)
    .map(l => { const v = parseRow(l); const o = {}; hdrs.forEach((h, i) => { o[h.trim()] = (v[i] || '').trim(); }); return o; })
    .filter(r => Object.values(r).some(x => x));
}

export const toNum = v => {
  if (!v || v === '-' || v === '') return 0;
  return parseFloat(String(v).replace(/[$,%]/g, '').replace(/,/g, '')) || 0;
};

export function detectChannel(hdrs) {
  const h = hdrs.join(' ').toLowerCase();
  if (h.includes('frequency') || h.includes('purchase roas') || h.includes('result indicator')) return 'meta';
  if (h.includes('view rate') || h.includes('cpv')) return 'youtube';
  return 'google';
}

export function normalizeMeta(rows) {
  return rows.map(r => ({
    name: r['Campaign name'] || r['Campaign'] || 'Unknown',
    spend: toNum(r['Amount spent (USD)'] || r['Amount spent'] || r['Spend'] || 0),
    purchases: toNum(r['Purchases'] || r['Results'] || 0),
    roas: toNum(r['Purchase ROAS (return on ad spend)'] || r['ROAS'] || 0),
    cpm: toNum(r['CPM (cost per 1,000 impressions) (USD)'] || r['CPM'] || 0),
    frequency: toNum(r['Frequency'] || 0),
    impressions: toNum(r['Impressions'] || 0),
    reach: toNum(r['Reach'] || 0),
    ch: 'meta'
  })).filter(r => r.spend > 0);
}

export function normalizeGoogle(rows) {
  return rows.map(r => {
    const spend = toNum(r['Cost'] || r['Spend'] || 0);
    const cv = toNum(r['Conv. value'] || r['Conversion value'] || r['All conv. value'] || 0);
    const convs = toNum(r['Conversions'] || r['Conv.'] || r['All conv.'] || 0);
    const impr = toNum(r['Impr.'] || r['Impressions'] || 0);
    const clicks = toNum(r['Clicks'] || 0);
    return {
      name: r['Campaign'] || r['Campaign name'] || 'Unknown',
      spend, conversions: convs, convValue: cv,
      roas: spend > 0 && cv > 0 ? cv / spend : 0,
      cpa: convs > 0 ? spend / convs : 0,
      impressions: impr, clicks,
      ctr: impr > 0 ? (clicks / impr) * 100 : 0,
      ch: 'google'
    };
  }).filter(r => r.spend > 0);
}

export function buildDataSummary(data, nmpds, roasOverall) {
  const parts = Object.entries(data)
    .filter(([, v]) => v)
    .map(([ch, d]) => {
      const rows = d.rows;
      const ts = rows.reduce((s, r) => s + r.spend, 0);
      const tc = rows.reduce((s, r) => s + (r.purchases || r.conversions || 0), 0);
      const bR = rows.reduce((s, r) => s + r.roas * r.spend, 0) / (ts || 1);
      const bC = tc > 0 ? ts / tc : 0;
      let s = `CHANNEL: ${ch.toUpperCase()} | Spend: $${ts.toFixed(0)} | Conversions: ${tc} | ROAS: ${bR.toFixed(2)}x | CPA: $${bC.toFixed(2)}\n\nCAMPAIGNS:\n`;
      rows.forEach(r => {
        if (ch === 'meta') {
          const cpa = r.purchases > 0 ? (r.spend / r.purchases).toFixed(2) : 'N/A';
          s += `- "${r.name}": Spend $${r.spend.toFixed(0)}, Purchases ${r.purchases}, ROAS ${r.roas.toFixed(2)}x, CPA $${cpa}, Frequency ${r.frequency.toFixed(2)}, CPM $${r.cpm.toFixed(2)}\n`;
        } else {
          s += `- "${r.name}": Spend $${r.spend.toFixed(0)}, Conv ${r.conversions.toFixed(0)}, ROAS ${r.roas.toFixed(2)}x, CPA $${r.cpa.toFixed(2)}, CTR ${r.ctr.toFixed(2)}%\n`;
        }
      });
      return s;
    });
  parts.push(`\nFUNNEL.IO: NMPDS $${nmpds}, ROAS ${roasOverall}x, Spend $13.8K, Sales $318K, Break-even 5x, Scale threshold 6.5x`);
  return parts.join('\n\n---\n\n');
}

export function getSignal(roas) {
  if (roas >= 6.5) return ['Scale', '#00e0b0'];
  if (roas >= 5.5) return ['Optimize', '#ffb224'];
  if (roas >= 5.0) return ['Watch', '#ffb224'];
  return ['Pause', '#ff6b5b'];
}

export function getFreqBadge(freq) {
  if (freq >= 5.5) return ['Critical', 'r'];
  if (freq >= 4.5) return ['Warning', 'r'];
  if (freq >= 3.0) return ['Watch', 'w'];
  return ['OK', 'g'];
}
