import { useState, useRef, useCallback } from 'react';
import { parseCSV, detectChannel, normalizeMeta, normalizeGoogle, normalizeYouTube, buildDataSummary, getSignal, getFreqBadge } from './utils';
import { API_URL, MEDIA_BUYER_SYSTEM, CREATIVE_SYSTEM, CHAT_SYSTEM } from './constants';

const C = {
  accent: '#c8f135',
  teal: '#00e0b0',
  coral: '#ff6b5b',
  amber: '#ffb224',
  violet: '#8b6fff',
  meta: '#1877f2',
  google: '#ea4335',
};

const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function Badge({ type, children }) {
  const colors = { g: [C.teal, 'rgba(0,224,176,0.12)'], w: [C.amber, 'rgba(255,178,36,0.12)'], r: [C.coral, 'rgba(255,107,91,0.12)'], v: [C.violet, 'rgba(139,111,255,0.12)'], l: [C.accent, 'rgba(200,241,53,0.12)'] };
  const [color, bg] = colors[type] || colors.v;
  return <span style={{ ...mono, fontSize: 9, padding: '3px 7px', borderRadius: 4, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase', background: bg, color, display: 'inline-block' }}>{children}</span>;
}

function Spinner({ color = '#000' }) {
  return <div style={{ width: 16, height: 16, border: `2px solid ${color}22`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#161619', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ ...mono, fontSize: 9, color: '#555560', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 5, color: color || '#e8e8ee' }}>{value}</div>
      {sub && <div style={{ ...mono, fontSize: 10, color: color || '#555560' }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: '#111115', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 14, ...style }}>{children}</div>;
}

function CardHead({ children, color }) {
  return <div style={{ ...mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: color || '#555560', marginBottom: 14 }}>{children}</div>;
}

function UploadZone({ channel, onFile, label, hint }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f, channel); }}
      style={{ border: `2px dashed ${over ? C.accent : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', position: 'relative', background: over ? 'rgba(200,241,53,0.03)' : '#0f0f12', marginBottom: 14, transition: 'all 0.2s' }}
    >
      <input type="file" accept=".csv" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0], channel); }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ ...mono, fontSize: 11, color: '#666672', lineHeight: 1.7 }}>{hint}</div>
    </div>
  );
}

function InsightRec({ rec }) {
  const barColor = rec.priority === 'HIGH' ? C.coral : rec.priority === 'MEDIUM' ? C.amber : C.teal;
  const badgeType = rec.priority === 'HIGH' ? 'r' : rec.priority === 'MEDIUM' ? 'w' : 'g';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 3, borderRadius: 2, background: barColor, flexShrink: 0, alignSelf: 'stretch', minHeight: 40 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {rec.title}
          <Badge type={badgeType}>{rec.priority}</Badge>
          {rec.category && <Badge type="v">{rec.category}</Badge>}
        </div>
        <div style={{ ...mono, fontSize: 11, color: '#9898a8', lineHeight: 1.7 }}>{rec.body}</div>
        {rec.nextStep && <div style={{ ...mono, fontSize: 10, color: C.accent, marginTop: 8 }}>→ {rec.nextStep}</div>}
      </div>
    </div>
  );
}

function ListItem({ item, color }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0, minHeight: 28, alignSelf: 'stretch' }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{item.name || item.title}</div>
        <div style={{ ...mono, fontSize: 10, color: '#9898a8', lineHeight: 1.5 }}>{item.reason || item.rationale}</div>
        {item.structure && <div style={{ ...mono, fontSize: 10, color: C.accent, marginTop: 4 }}>Setup: {item.structure}</div>}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 75 ? C.teal : pct >= 50 ? C.amber : C.coral;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 11, flex: 1, color: '#9898a8' }}>{label}</span>
      <div style={{ width: 80, height: 4, background: '#1e1e22', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
      </div>
      <span style={{ ...mono, fontSize: 10, color, minWidth: 32, textAlign: 'right' }}>{value}/{max}</span>
    </div>
  );
}

function CampaignTable({ rows, channel }) {
  const sorted = [...rows].sort((a, b) => b.spend - a.spend);
  const thStyle = { ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555560', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left', fontWeight: 500 };
  const tdStyle = { padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Campaign</th>
            <th style={thStyle}>Spend</th>
            <th style={thStyle}>{channel === 'meta' ? 'Purchases' : 'Conv.'}</th>
            <th style={thStyle}>CPA</th>
            <th style={thStyle}>ROAS</th>
            <th style={thStyle}>{channel === 'meta' ? 'Freq' : 'CTR'}</th>
            <th style={thStyle}>{channel === 'meta' ? 'CPM' : 'Impr.'}</th>
            <th style={thStyle}>Zone</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const cpa = (r.purchases || r.conversions) > 0 ? (r.spend / (r.purchases || r.conversions)).toFixed(2) : null;
            const [sigLabel, sigColor] = getSignal(r.roas);
            const [freqLabel, freqType] = getFreqBadge(r.frequency || 0);
            return (
              <tr key={i}>
                <td style={{ ...tdStyle, ...mono, fontSize: 10 }} title={r.name}>{r.name.length > 34 ? r.name.slice(0, 31) + '…' : r.name}</td>
                <td style={{ ...tdStyle, ...mono }}>${r.spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td style={{ ...tdStyle, ...mono }}>{(r.purchases || r.conversions || 0).toFixed(0)}</td>
                <td style={{ ...tdStyle, ...mono }}>{cpa ? '$' + cpa : '—'}</td>
                <td style={{ ...tdStyle, ...mono, color: r.roas >= 6.5 ? C.teal : r.roas >= 5 ? C.amber : C.coral }}>{r.roas.toFixed(2)}×</td>
                <td style={tdStyle}>
                  {channel === 'meta'
                    ? <Badge type={freqType}>{(r.frequency || 0).toFixed(2)}</Badge>
                    : <span style={{ ...mono, fontSize: 11 }}>{(r.ctr || 0).toFixed(2)}%</span>}
                </td>
                <td style={{ ...tdStyle, ...mono }}>
                  {channel === 'meta' ? '$' + (r.cpm || 0).toFixed(2) : (r.impressions || 0).toLocaleString()}
                </td>
                <td style={{ ...tdStyle, ...mono, fontSize: 10, color: sigColor }}>{sigLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({ meta: null, google: null, youtube: null });
  const [briefing, setBriefing] = useState(null);
  const [creativeData, setCreativeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [nmpds, setNmpds] = useState('2.46');
  const [roasOverall, setRoasOverall] = useState('6.92');
  const [error, setError] = useState('');
  const chatRef = useRef(null);
  const msgInterval = useRef(null);

  const hasData = Object.values(data).some(v => v);

  const LOADING_MSGS = [
    'Checking frequency thresholds…',
    'Applying three-strikes kill rule…',
    'Scoring campaign structure…',
    'Evaluating creative fatigue…',
    'Building scaling recommendations…',
    'Generating new ad set proposals…',
    'Calculating NMPDS action zones…',
  ];

  const processFile = useCallback((file, channel) => {
    if (!file || !file.name.endsWith('.csv')) { alert('Please upload a .csv file'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const raw = parseCSV(e.target.result);
      if (!raw.length) { alert('No data found in CSV'); return; }
      const hdrs = Object.keys(raw[0]);
      const ch = channel === 'auto' ? detectChannel(hdrs) : channel;
      let rows;
      if (ch === 'meta') rows = normalizeMeta(raw);
      else if (ch === 'youtube') rows = normalizeYouTube(raw);
      else rows = normalizeGoogle(raw);
      if (!rows.length) { alert('No campaigns with spend found — check column names'); return; }
      setData(prev => ({ ...prev, [ch]: { rows, file: file.name } }));
      setTab('dashboard');
    };
    reader.readAsText(file);
  }, []);

  const callAPI = async (system, userContent, maxTokens = 2200) => {
    const res = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages: [{ role: 'user', content: userContent }], max_tokens: maxTokens })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    const result = await res.json();
    return result.content?.[0]?.text || '';
  };

  const runBriefing = async () => {
    if (!hasData) return;
    setLoading(true);
    setError('');
    setBriefing(null);
    let mi = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    msgInterval.current = setInterval(() => { mi++; setLoadingMsg(LOADING_MSGS[mi % LOADING_MSGS.length]); }, 2200);
    try {
      const summary = buildDataSummary(data, nmpds, roasOverall);
      const txt = await callAPI(MEDIA_BUYER_SYSTEM, summary + '\n\nGenerate a full media buyer briefing.', 2200);
      const clean = txt.replace(/```json\n?|```\n?/g, '').trim();
      setBriefing(JSON.parse(clean));
    } catch (err) {
      setError('Analysis failed: ' + err.message + '. Check that your Railway backend is running and REACT_APP_API_URL is set.');
    }
    clearInterval(msgInterval.current);
    setLoading(false);
  };

  const runCreative = async () => {
    if (!data.meta) return;
    setCreativeLoading(true);
    setCreativeData(null);
    const rows = data.meta.rows;
    const metaSum = rows.map(r => `- "${r.name}": ROAS ${r.roas.toFixed(2)}x, Frequency ${r.frequency.toFixed(2)}, CPM $${r.cpm.toFixed(2)}, Spend $${r.spend.toFixed(0)}, Purchases ${r.purchases}`).join('\n');
    try {
      const txt = await callAPI(CREATIVE_SYSTEM, `Meta campaign data:\n${metaSum}\n\nAnalyze creative fatigue and generate production briefs for a woodworking tools audience.`, 1400);
      const clean = txt.replace(/```json\n?|```\n?/g, '').trim();
      setCreativeData(JSON.parse(clean));
    } catch (err) {
      setError('Creative analysis failed: ' + err.message);
    }
    setCreativeLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const context = `CAMPAIGN DATA:\n${buildDataSummary(data, nmpds, roasOverall)}\n\nPREVIOUS BRIEFING:\n${briefing?.execSummary || 'No briefing run yet'}\n\nQUESTION: ${msg}`;
      const txt = await callAPI(CHAT_SYSTEM + '\n\nBe conversational but direct. Reference campaign data.', context, 700);
      setChatHistory(prev => [...prev, { role: 'assistant', content: txt }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }]);
    }
    setChatLoading(false);
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  };

  const allRows = [...(data.meta?.rows || []), ...(data.google?.rows || [])];
  const totalSpend = allRows.reduce((s, r) => s + r.spend, 0);
  const totalConv = allRows.reduce((s, r) => s + (r.purchases || r.conversions || 0), 0);
  const blendedRoas = allRows.reduce((s, r) => s + r.roas * r.spend, 0) / (totalSpend || 1);
  const primaryRows = data.meta?.rows || data.google?.rows || [];

  const gradeColor = g => ({ A: C.teal, B: '#639922', C: C.amber, D: C.coral, F: C.coral }[g] || '#555');
  const gradeLabel = g => ({ A: 'Excellent', B: 'Good', C: 'Needs work', D: 'Issues present', F: 'Urgent' }[g] || '');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analysis', label: '🧠 AI Media Buyer' },
    { id: 'meta', label: 'Meta' },
    { id: 'google', label: 'Google' },
    { id: 'creative', label: 'Creative' },
    { id: 'setup', label: 'Setup' },
  ];

  return (
    <div style={{ background: '#080809', minHeight: '100vh', color: '#e8e8ee', fontFamily: "'Epilogue', sans-serif" }}>

      {/* TOPBAR */}
      <div style={{ height: 50, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, background: 'rgba(8,8,9,0.98)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ width: 26, height: 26, background: C.accent, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#000' }}>KM</div>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Media Buyer</span>
        <span style={{ ...mono, fontSize: 9, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', color: '#666', padding: '2px 7px', borderRadius: 20 }}>2026</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', ...mono, fontSize: 10, color: '#444' }}>
          {hasData && <span style={{ color: C.teal, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: C.teal }} />Data loaded</span>}
          <span>Break-even 5×</span>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0f0f12', padding: '0 24px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '11px 16px', fontSize: 12, fontWeight: 600, color: tab === t.id ? '#e8e8ee' : '#555560', cursor: 'pointer', borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1200 }}>

        {error && (
          <div style={{ background: 'rgba(255,107,91,0.1)', border: '1px solid rgba(255,107,91,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 14, ...mono, fontSize: 11, color: C.coral }}>
            {error}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Dashboard</div>
                <div style={{ ...mono, fontSize: 10, color: '#555560', marginTop: 3 }}>Funnel.io · Last 30 days · 7-day lookback attribution</div>
              </div>
              {!hasData && <button onClick={() => setTab('meta')} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: C.accent, color: '#000' }}>+ Import CSV</button>}
            </div>

            {/* Funnel.io panel */}
            <Card style={{ borderColor: 'rgba(200,241,53,0.15)', background: '#0f0f12' }}>
              <CardHead color={C.accent}>Funnel.io actuals — update these from your dashboard</CardHead>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                <MetricCard label="NMPDS overall" value={`$${nmpds}`} sub={parseFloat(nmpds) >= 2 ? 'Scale zone' : 'Optimize zone'} color={parseFloat(nmpds) >= 2 ? C.teal : C.amber} />
                <MetricCard label="ROAS overall" value={`${roasOverall}×`} sub={parseFloat(roasOverall) >= 6.5 ? '↑ Scale zone' : parseFloat(roasOverall) >= 5 ? '~ Optimize' : '↓ Watch'} color={parseFloat(roasOverall) >= 6.5 ? C.teal : parseFloat(roasOverall) >= 5 ? C.amber : C.coral} />
                <MetricCard label="Media spend" value="$13.8K" sub="Last 30 days" />
                <MetricCard label="Total sales" value="$318K" sub="7-day attribution" />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...mono, fontSize: 11, color: '#666' }}>Update numbers:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 11, color: '#888' }}>NMPDS $</span>
                  <input value={nmpds} onChange={e => setNmpds(e.target.value)} style={{ width: 70, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: '#e8e8ee', ...mono, fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...mono, fontSize: 11, color: '#888' }}>ROAS</span>
                  <input value={roasOverall} onChange={e => setRoasOverall(e.target.value)} style={{ width: 60, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: '#e8e8ee', ...mono, fontSize: 12 }} />
                </div>
              </div>
            </Card>

            {!hasData ? (
              <div style={{ textAlign: 'center', padding: '52px 20px' }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⚡</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Import your ad platform CSVs</div>
                <div style={{ ...mono, fontSize: 11, color: '#666', lineHeight: 1.8, marginBottom: 20 }}>Meta Ads Manager · Google Ads · YouTube — auto-detected from column headers</div>
                <UploadZone channel="auto" onFile={processFile} label="Drop any ad CSV here" hint="Meta, Google Ads, or YouTube campaign export" />
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                  <MetricCard label="CSV total spend" value={'$' + totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })} sub="Across loaded channels" />
                  <MetricCard label="Conversions" value={totalConv.toLocaleString()} sub="From platform data" />
                  <MetricCard label="Platform ROAS" value={blendedRoas.toFixed(2) + '×'} sub="CSV blended" color={blendedRoas >= 6.5 ? C.teal : blendedRoas >= 5 ? C.amber : C.coral} />
                  <MetricCard label="Campaigns" value={primaryRows.length} sub={Object.entries(data).filter(([, v]) => v).map(([k]) => k).join(' · ')} />
                </div>
                <Card>
                  <CardHead>Campaigns</CardHead>
                  <CampaignTable rows={primaryRows} channel={data.meta ? 'meta' : 'google'} />
                </Card>
                <div style={{ background: 'linear-gradient(135deg,rgba(200,241,53,0.07),rgba(139,111,255,0.07))', border: '1px solid rgba(200,241,53,0.18)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Run your AI Media Buyer briefing</div>
                    <div style={{ ...mono, fontSize: 11, color: '#666' }}>190 checks · 2026 frameworks · Funnel.io NMPDS integrated · 5× break-even anchor</div>
                  </div>
                  <button onClick={() => { setTab('analysis'); setTimeout(runBriefing, 100); }} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', background: C.accent, color: '#000' }}>
                    Generate Briefing ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI ANALYSIS ── */}
        {tab === 'analysis' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>AI Media Buyer</div>
                <div style={{ ...mono, fontSize: 10, color: '#555560', marginTop: 3 }}>2026 frameworks · 190 checks · NMPDS-anchored · 5× break-even</div>
              </div>
            </div>

            <button
              disabled={!hasData || loading}
              onClick={runBriefing}
              style={{ width: '100%', padding: 16, background: !hasData || loading ? '#1a1a1f' : C.accent, color: !hasData || loading ? '#444' : '#000', border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: !hasData || loading ? 'not-allowed' : 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.15s' }}
            >
              {loading ? <><Spinner color={C.accent} /><span style={{ color: C.accent }}>{loadingMsg}</span></> : briefing ? '🔄  Re-run Briefing' : hasData ? '🧠  Generate Briefing' : 'Load data first on the Meta or Google tab'}
            </button>

            {!briefing && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555560' }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🧠</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee', marginBottom: 8 }}>Senior media buyer on standby</div>
                <div style={{ ...mono, fontSize: 11, lineHeight: 1.8 }}>Import CSV data on the Meta or Google tab, then hit the button above.</div>
              </div>
            )}

            {briefing && (
              <div>
                {/* Health */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Card>
                    <CardHead>Account health score</CardHead>
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', color: gradeColor(briefing.healthGrade) }}>{briefing.healthScore}</div>
                      <div style={{ ...mono, fontSize: 12, color: '#666', marginTop: 4 }}>Grade {briefing.healthGrade} — {gradeLabel(briefing.healthGrade)}</div>
                      <div style={{ height: 6, background: '#1e1e22', borderRadius: 3, overflow: 'hidden', marginTop: 12 }}>
                        <div style={{ height: '100%', width: `${briefing.healthScore}%`, background: gradeColor(briefing.healthGrade), borderRadius: 3, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <CardHead>Dimension scores</CardHead>
                    {briefing.dimensionScores && [['Campaign Structure', 'campaignStructure', 20], ['Creative Quality', 'creativeQuality', 25], ['Audience & Targeting', 'audienceTargeting', 20], ['Bidding & Budget', 'biddingBudget', 15], ['Tracking', 'tracking', 10], ['Account Hygiene', 'accountHygiene', 10]].map(([l, k, m]) => (
                      <ScoreBar key={k} label={l} value={briefing.dimensionScores[k] || 0} max={m} />
                    ))}
                  </Card>
                </div>

                <Card>
                  <CardHead>Executive brief</CardHead>
                  <div style={{ ...mono, fontSize: 11, color: '#9898a8', lineHeight: 1.8 }}>{briefing.execSummary}</div>
                </Card>

                <Card>
                  <CardHead>Recommendations</CardHead>
                  {(briefing.recommendations || []).map((r, i) => <InsightRec key={i} rec={r} />)}
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Card>
                    <CardHead color={C.teal}>Scale these ↑</CardHead>
                    {(briefing.scale || []).length ? briefing.scale.map((i, idx) => <ListItem key={idx} item={i} color={C.teal} />) : <div style={{ ...mono, fontSize: 10, color: '#444' }}>None flagged</div>}
                  </Card>
                  <Card>
                    <CardHead color={C.coral}>Pause or fix ✕</CardHead>
                    {(briefing.pause || []).length ? briefing.pause.map((i, idx) => <ListItem key={idx} item={i} color={C.coral} />) : <div style={{ ...mono, fontSize: 10, color: '#444' }}>None flagged</div>}
                  </Card>
                  <Card>
                    <CardHead color={C.amber}>New ad sets to test</CardHead>
                    {(briefing.newAdSets || []).length ? briefing.newAdSets.map((i, idx) => <ListItem key={idx} item={i} color={C.amber} />) : <div style={{ ...mono, fontSize: 10, color: '#444' }}>None suggested</div>}
                  </Card>
                </div>

                <Card>
                  <CardHead>Creative recommendations</CardHead>
                  {(briefing.creativeRecs || []).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 3, borderRadius: 2, background: C.amber, flexShrink: 0, minHeight: 36, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                          {r.title} <Badge type="w">{r.type}</Badge>
                        </div>
                        <div style={{ ...mono, fontSize: 11, color: '#9898a8', lineHeight: 1.7 }}>{r.detail}</div>
                      </div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <CardHead>Budget reallocation</CardHead>
                  {(briefing.budgetMoves || []).map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 3, borderRadius: 2, background: C.violet, flexShrink: 0, minHeight: 28, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{m.amount} — {m.from} → {m.to}</div>
                        <div style={{ ...mono, fontSize: 10, color: '#9898a8' }}>{m.reason}</div>
                      </div>
                    </div>
                  ))}
                  {briefing.positives?.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <CardHead>What's working</CardHead>
                      {briefing.positives.map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: 3, borderRadius: 2, background: C.teal, flexShrink: 0, minHeight: 28, alignSelf: 'stretch' }} />
                          <div style={{ ...mono, fontSize: 11, color: '#9898a8' }}>{p}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Chat */}
                <Card>
                  <CardHead>Ask your media buyer</CardHead>
                  <div ref={chatRef} style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                    {chatHistory.length === 0 && (
                      <div style={{ ...mono, fontSize: 11, color: '#444', padding: '8px 0' }}>Ask anything about your campaigns — strategy, creative, scaling, budget decisions…</div>
                    )}
                    {chatHistory.map((m, i) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ ...mono, fontSize: 9, color: m.role === 'user' ? '#555560' : C.accent, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.role === 'user' ? 'You' : 'Media Buyer'}</div>
                        <div style={{ ...mono, fontSize: 11, color: m.role === 'user' ? '#e8e8ee' : '#9898a8', lineHeight: 1.7, borderLeft: m.role === 'assistant' ? `2px solid ${C.accent}` : 'none', paddingLeft: m.role === 'assistant' ? 12 : 0, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      </div>
                    ))}
                    {chatLoading && <div style={{ display: 'flex', gap: 8, alignItems: 'center', ...mono, fontSize: 11, color: C.accent }}><Spinner color={C.accent} />Thinking…</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder="e.g. Should I duplicate Product Sets ASC? What hooks work for router tables?" style={{ flex: 1, background: '#161619', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', color: '#e8e8ee', ...mono, fontSize: 12, resize: 'none', minHeight: 42, maxHeight: 100, outline: 'none' }} />
                    <button onClick={sendChat} disabled={chatLoading} style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: C.accent, color: '#000', flexShrink: 0 }}>Ask ↗</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── META ── */}
        {tab === 'meta' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.meta, display: 'inline-block' }} />Meta · Facebook / Instagram
            </div>
            <div style={{ ...mono, fontSize: 10, color: '#555560', marginBottom: 20 }}>Ads Manager → Campaigns → Export CSV · Include: Amount spent, Purchases, ROAS, CPM, Frequency, Reach</div>
            <UploadZone channel="meta" onFile={processFile} label="Drop Meta Ads campaign CSV" hint="Ads Manager → Campaigns → set date range → Export" />
            {data.meta && (
              <Card>
                <CardHead>{data.meta.file} · {data.meta.rows.length} campaigns</CardHead>
                <CampaignTable rows={data.meta.rows} channel="meta" />
              </Card>
            )}
          </div>
        )}

        {/* ── GOOGLE ── */}
        {tab === 'google' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.google, display: 'inline-block' }} />Google Ads · Search / Shopping / PMax
            </div>
            <div style={{ ...mono, fontSize: 10, color: '#555560', marginBottom: 20 }}>Google Ads → Campaigns → Download report · Include: Cost, Conversions, Conv. value, Clicks, CTR</div>
            <UploadZone channel="google" onFile={processFile} label="Drop Google Ads campaign CSV" hint="Campaigns tab → Download → CSV" />
            {data.google && (
              <Card>
                <CardHead>{data.google.file} · {data.google.rows.length} campaigns</CardHead>
                <CampaignTable rows={data.google.rows} channel="google" />
              </Card>
            )}
          </div>
        )}

        {/* ── CREATIVE ── */}
        {tab === 'creative' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>Creative Analysis</div>
                <div style={{ ...mono, fontSize: 10, color: '#555560', marginTop: 3 }}>Fatigue signals · Hook angles · Production briefs for woodworking buyers</div>
              </div>
              <button disabled={!data.meta || creativeLoading} onClick={runCreative} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: !data.meta || creativeLoading ? 'not-allowed' : 'pointer', background: !data.meta || creativeLoading ? '#1a1a1f' : C.accent, color: !data.meta || creativeLoading ? '#444' : '#000' }}>
                {creativeLoading ? 'Analyzing…' : 'Analyze Creatives'}
              </button>
            </div>
            {!data.meta && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555560' }}><div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🎨</div><div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee', marginBottom: 8 }}>Load Meta data first</div></div>}
            {creativeLoading && <div style={{ display: 'flex', gap: 10, alignItems: 'center', ...mono, fontSize: 12, color: C.accent, padding: '16px 0' }}><Spinner color={C.accent} />Analyzing creative fatigue and building briefs…</div>}
            {creativeData && (
              <div>
                <Card>
                  <CardHead>Fatigue assessment</CardHead>
                  {(creativeData.fatigueAssessment || []).map((f, i) => {
                    const c = f.status === 'OK' ? C.teal : f.status === 'Watch' ? C.amber : C.coral;
                    const bt = f.status === 'OK' ? 'g' : f.status === 'Watch' ? 'w' : 'r';
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 3, borderRadius: 2, background: c, flexShrink: 0, minHeight: 36, alignSelf: 'stretch' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {f.campaign.length > 40 ? f.campaign.slice(0, 37) + '…' : f.campaign}
                            <Badge type={bt}>{f.status}</Badge>
                            <span style={{ ...mono, fontSize: 10, color: '#555560' }}>freq {f.frequency}</span>
                          </div>
                          <div style={{ ...mono, fontSize: 10, color: C.accent }}>→ {f.action}</div>
                        </div>
                      </div>
                    );
                  })}
                </Card>
                <Card>
                  <CardHead>Hook angles to test</CardHead>
                  {(creativeData.hookAngles || []).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: 3, borderRadius: 2, background: C.accent, flexShrink: 0, minHeight: 36, alignSelf: 'stretch' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{h.angle}</div>
                        <div style={{ ...mono, fontSize: 12, color: C.accent, background: '#161619', padding: '6px 10px', borderRadius: 5, marginBottom: 6 }}>"{h.hook}"</div>
                        <div style={{ ...mono, fontSize: 11, color: '#9898a8', lineHeight: 1.7 }}>{h.why}</div>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card>
                  <CardHead>Creative briefs — produce these next</CardHead>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                    {(creativeData.creativeBriefs || []).map((b, i) => (
                      <div key={i} style={{ background: '#161619', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 14 }}>
                        <div style={{ ...mono, fontSize: 9, color: '#555560', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{b.format} · {b.audience}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{b.title}</div>
                        <div style={{ ...mono, fontSize: 10, color: C.accent, marginBottom: 6 }}>Hook: "{b.hook}"</div>
                        <div style={{ ...mono, fontSize: 10, color: '#9898a8', lineHeight: 1.6, marginBottom: 8 }}>{b.visual || b.body || ''}</div>
                        <div style={{ ...mono, fontSize: 10, color: C.amber }}>CTA: {b.cta}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── SETUP ── */}
        {tab === 'setup' && (
          <div style={{ animation: 'rise 0.2s ease' }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Setup</div>
            <div style={{ ...mono, fontSize: 10, color: '#555560', marginBottom: 20 }}>Deployment guide + API roadmap</div>

            <Card style={{ borderColor: 'rgba(200,241,53,0.2)' }}>
              <CardHead color={C.accent}>Deployment status</CardHead>
              <div style={{ ...mono, fontSize: 11, color: '#9898a8', lineHeight: 2 }}>
                <div>Backend URL: <span style={{ color: C.accent }}>{API_URL}</span></div>
                <div>Set <code style={{ background: '#1a1a1f', padding: '1px 5px', borderRadius: 3 }}>REACT_APP_API_URL</code> in Vercel to your Railway backend URL</div>
                <div>Set <code style={{ background: '#1a1a1f', padding: '1px 5px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code> in Railway environment variables</div>
                <div>Set <code style={{ background: '#1a1a1f', padding: '1px 5px', borderRadius: 3 }}>FRONTEND_URL</code> in Railway to your Vercel URL (for CORS)</div>
              </div>
            </Card>

            <Card>
              <CardHead>Integration roadmap</CardHead>
              {[['✓', 'done', 'CSV Import', 'Meta · Google Ads · YouTube · Auto-detected. Live today.', 'Live', C.teal],
                ['✓', 'done', 'Railway Backend', 'Express proxy server — holds API key securely, enables analyze button', 'Deploy', C.accent],
                ['✓', 'done', 'Vercel Frontend', 'React app — deploys from GitHub, instant updates on push', 'Deploy', C.accent],
                ['2', 'next', 'Meta Marketing API', 'Live campaign + ad set + creative level data. No more CSV exports.', 'Next', C.amber],
                ['3', 'todo', 'Google Ads API', 'Live Search, Shopping, PMax, YouTube data', 'Planned', C.violet],
                ['4', 'todo', 'Funnel.io Webhook', 'Auto-pull NMPDS + blended ROAS daily instead of manual entry', 'Planned', C.violet],
                ['5', 'todo', 'Slack Alerts', 'Frequency spike alerts · CPA breaches · Daily briefing digest', 'Planned', C.violet],
              ].map(([step, type, title, desc, badge, color]) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: type === 'done' ? C.teal : type === 'next' ? C.accent : '#1e1e22', color: type === 'todo' ? '#444' : '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{title}</div>
                    <div style={{ ...mono, fontSize: 10, color: '#666', lineHeight: 1.6 }}>{desc}</div>
                  </div>
                  <span style={{ ...mono, fontSize: 9, padding: '3px 7px', borderRadius: 4, background: color + '18', color, flexShrink: 0, fontWeight: 500 }}>{badge}</span>
                </div>
              ))}
            </Card>

            <Card>
              <CardHead>2026 frameworks loaded into the AI</CardHead>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, ...mono, fontSize: 10, color: '#666', lineHeight: 2 }}>
                <div>
                  <div style={{ color: '#e8e8ee', fontWeight: 600, marginBottom: 6 }}>Meta 2026</div>
                  {['Break-even ROAS = 5.0×, scale > 6.5×', 'ASC: 50 events/week, 15-50 creatives', '20% budget rule — no learning reset', 'Freq 3.0 → 4.5 → 5.5 kill thresholds', 'Three-strikes kill rule', 'Horizontal > vertical scaling', 'UGC outperforms polished ads', 'Budget consolidation wins'].map(t => <div key={t}>· {t}</div>)}
                </div>
                <div>
                  <div style={{ color: '#e8e8ee', fontWeight: 600, marginBottom: 6 }}>Google + Universal</div>
                  {['Power Pack: Demand Gen → AI Max → PMax', '3× Kill Rule: CPA > 3× target = pause', '70/20/10 budget split', 'Budget ≥ 5× target CPA per campaign', '190-check audit framework', 'Woodworking buyer persona baked in', 'NMPDS thresholds from Funnel.io', 'Creative angle library for wood buyers'].map(t => <div key={t}>· {t}</div>)}
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
