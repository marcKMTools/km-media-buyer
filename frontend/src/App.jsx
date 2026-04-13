import { useState, useRef, useCallback } from 'react'
import { parseCSV, detectChannel, normalizeMeta, normalizeGoogle, buildDataSummary, getSignal, getFreqBadge } from './utils.js'
import { API_URL, MEDIA_BUYER_SYSTEM, CREATIVE_SYSTEM, CHAT_SYSTEM } from './constants.js'
import { parseFunnelPDF } from './parseFunnelPDF.js'

const C = { accent:'#c8f135', teal:'#00e0b0', coral:'#ff6b5b', amber:'#ffb224', violet:'#8b6fff', meta:'#1877f2', google:'#ea4335' }
const mono = { fontFamily:"'IBM Plex Mono', monospace" }

function Badge({ type, children }) {
  const colors = { g:[C.teal,'rgba(0,224,176,0.12)'], w:[C.amber,'rgba(255,178,36,0.12)'], r:[C.coral,'rgba(255,107,91,0.12)'], v:[C.violet,'rgba(139,111,255,0.12)'], l:[C.accent,'rgba(200,241,53,0.12)'] }
  const [color, bg] = colors[type] || colors.v
  return <span style={{...mono,fontSize:9,padding:'3px 7px',borderRadius:4,fontWeight:500,letterSpacing:'0.03em',textTransform:'uppercase',background:bg,color,display:'inline-block'}}>{children}</span>
}
function Spinner({ color='#000' }) {
  return <div style={{width:16,height:16,border:`2px solid ${color}22`,borderTopColor:color,borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}} />
}
function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{background:'#161619',borderRadius:10,padding:'14px 16px'}}>
      <div style={{...mono,fontSize:9,color:'#555560',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,marginBottom:5,color:color||'#e8e8ee'}}>{value}</div>
      {sub && <div style={{...mono,fontSize:10,color:color||'#555560'}}>{sub}</div>}
    </div>
  )
}
function Card({ children, style }) {
  return <div style={{background:'#111115',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:20,marginBottom:14,...style}}>{children}</div>
}
function CardHead({ children, color }) {
  return <div style={{...mono,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:color||'#555560',marginBottom:14}}>{children}</div>
}
function UploadZone({ channel, onFile, label, hint, compact, accept }) {
  const [over, setOver] = useState(false)
  const fileAccept = accept || '.csv'
  const handleDrop = (e) => { e.preventDefault(); setOver(false); const f=e.dataTransfer.files[0]; if(f)onFile(f,channel) }
  return (
    <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={handleDrop}
      style={{border:`2px dashed ${over?C.accent:'rgba(255,255,255,0.12)'}`,borderRadius:10,padding:compact?'12px 16px':'28px 24px',textAlign:'center',cursor:'pointer',position:'relative',background:over?'rgba(200,241,53,0.03)':'#0f0f12',marginBottom:10,transition:'all 0.2s'}}>
      <input type="file" accept={fileAccept} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0],channel)}} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
      {!compact && <div style={{fontSize:22,marginBottom:8}}>📂</div>}
      <div style={{fontSize:compact?12:14,fontWeight:700,marginBottom:compact?0:4}}>{label}</div>
      {!compact && hint && <div style={{...mono,fontSize:11,color:'#666672',lineHeight:1.7,marginTop:6}}>{hint}</div>}
    </div>
  )
}
function ImageUploadZone({ onImages, images }) {
  const [over, setOver] = useState(false)
  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!valid.length) { alert('Please upload image files'); return }
    onImages(prev => [...prev, ...valid].slice(0, 6))
  }
  return (
    <div>
      <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);handleFiles(e.dataTransfer.files)}}
        style={{border:`2px dashed ${over?C.accent:'rgba(255,255,255,0.12)'}`,borderRadius:10,padding:'20px 24px',textAlign:'center',cursor:'pointer',position:'relative',background:over?'rgba(200,241,53,0.03)':'#0f0f12',marginBottom:12,transition:'all 0.2s'}}>
        <input type="file" accept="image/*" multiple onChange={e=>handleFiles(e.target.files)} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
        <div style={{fontSize:22,marginBottom:6}}>🖼️</div>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Drop ad creatives here</div>
        <div style={{...mono,fontSize:11,color:'#666672',lineHeight:1.7}}>Screenshots of your ads · Up to 6 · JPG or PNG · Tip: screenshot first frame of video ads</div>
      </div>
      {images.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {images.map((img,i) => (
            <div key={i} style={{position:'relative',borderRadius:8,overflow:'hidden',border:'1px solid rgba(255,255,255,0.1)',aspectRatio:'16/9',background:'#161619'}}>
              <img src={URL.createObjectURL(img)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              <button onClick={()=>onImages(prev=>prev.filter((_,j)=>j!==i))} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.75)',border:'none',color:'#fff',borderRadius:'50%',width:20,height:20,cursor:'pointer',fontSize:13,lineHeight:'20px'}}>×</button>
              <span style={{position:'absolute',bottom:4,left:4,...mono,fontSize:9,background:'rgba(0,0,0,0.7)',color:'#fff',padding:'2px 5px',borderRadius:3}}>{img.name.slice(0,18)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function InsightRec({ rec }) {
  const barColor = rec.priority==='HIGH'?C.coral:rec.priority==='MEDIUM'?C.amber:C.teal
  const badgeType = rec.priority==='HIGH'?'r':rec.priority==='MEDIUM'?'w':'g'
  return (
    <div style={{display:'flex',gap:12,padding:'16px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{width:3,borderRadius:2,background:barColor,flexShrink:0,alignSelf:'stretch',minHeight:40}} />
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:5,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {rec.title}<Badge type={badgeType}>{rec.priority}</Badge>{rec.category&&<Badge type="v">{rec.category}</Badge>}
        </div>
        <div style={{...mono,fontSize:11,color:'#9898a8',lineHeight:1.7}}>{rec.body}</div>
        {rec.nextStep&&<div style={{...mono,fontSize:10,color:C.accent,marginTop:8}}>→ {rec.nextStep}</div>}
      </div>
    </div>
  )
}
function ListItem({ item, color }) {
  return (
    <div style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{width:3,borderRadius:2,background:color,flexShrink:0,minHeight:28,alignSelf:'stretch'}} />
      <div>
        <div style={{fontSize:11,fontWeight:700,marginBottom:2}}>{item.name||item.title}</div>
        <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.5}}>{item.reason||item.rationale}</div>
        {item.structure&&<div style={{...mono,fontSize:10,color:C.accent,marginTop:4}}>Setup: {item.structure}</div>}
      </div>
    </div>
  )
}
function ScoreBar({ label, value, max }) {
  const pct = Math.round((value/max)*100)
  const color = pct>=75?C.teal:pct>=50?C.amber:C.coral
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
      <span style={{fontSize:11,flex:1,color:'#9898a8'}}>{label}</span>
      <div style={{width:80,height:4,background:'#1e1e22',borderRadius:2,overflow:'hidden',flexShrink:0}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:2,transition:'width 1s ease'}} />
      </div>
      <span style={{...mono,fontSize:10,color,minWidth:32,textAlign:'right'}}>{value}/{max}</span>
    </div>
  )
}
function CampaignTable({ rows, channel }) {
  const sorted = [...rows].sort((a,b)=>b.spend-a.spend)
  const th = {...mono,fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#555560',padding:'8px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',textAlign:'left',fontWeight:500}
  const td = {padding:'9px 10px',borderBottom:'1px solid rgba(255,255,255,0.04)'}
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr>
          <th style={th}>Campaign</th><th style={th}>Spend</th>
          <th style={th}>{channel==='meta'?'Purchases':'Conv.'}</th>
          <th style={th}>CPA</th><th style={th}>ROAS</th>
          <th style={th}>{channel==='meta'?'Freq':'CTR'}</th>
          <th style={th}>{channel==='meta'?'CPM':'Impr.'}</th>
          <th style={th}>Zone</th>
        </tr></thead>
        <tbody>
          {sorted.map((r,i)=>{
            const cpa=(r.purchases||r.conversions)>0?(r.spend/(r.purchases||r.conversions)).toFixed(2):null
            const [sigLabel,sigColor]=getSignal(r.roas)
            const [,freqType]=getFreqBadge(r.frequency||0)
            return (
              <tr key={i}>
                <td style={{...td,...mono,fontSize:10}} title={r.name}>{r.name.length>34?r.name.slice(0,31)+'…':r.name}</td>
                <td style={{...td,...mono}}>${r.spend.toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                <td style={{...td,...mono}}>{(r.purchases||r.conversions||0).toFixed(0)}</td>
                <td style={{...td,...mono}}>{cpa?'$'+cpa:'—'}</td>
                <td style={{...td,...mono,color:r.roas>=6.5?C.teal:r.roas>=5?C.amber:C.coral}}>{r.roas.toFixed(2)}×</td>
                <td style={td}>{channel==='meta'?<Badge type={freqType}>{(r.frequency||0).toFixed(2)}</Badge>:<span style={{...mono,fontSize:11}}>{(r.ctr||0).toFixed(2)}%</span>}</td>
                <td style={{...td,...mono}}>{channel==='meta'?'$'+(r.cpm||0).toFixed(2):(r.impressions||0).toLocaleString()}</td>
                <td style={{...td,...mono,fontSize:10,color:sigColor}}>{sigLabel}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
async function imageToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result.split(',')[1])
    reader.readAsDataURL(file)
  })
}

// ── WEEKLY CHECKLIST ITEM ─────────────────────────────────────
function CheckItem({ item }) {
  const icons = { scale:'↑', hold:'→', watch:'⚠', pause:'✕', new:'＋', creative:'🎨', budget:'$' }
  const colors = { scale:C.teal, hold:'#9898a8', watch:C.amber, pause:C.coral, new:C.accent, creative:C.amber, budget:C.violet }
  const bgs = { scale:'rgba(0,224,176,0.06)', hold:'rgba(255,255,255,0.03)', watch:'rgba(255,178,36,0.06)', pause:'rgba(255,107,91,0.06)', new:'rgba(200,241,53,0.06)', creative:'rgba(255,178,36,0.06)', budget:'rgba(139,111,255,0.06)' }
  const color = colors[item.type] || '#9898a8'
  const bg = bgs[item.type] || 'rgba(255,255,255,0.03)'
  const icon = icons[item.type] || '·'
  return (
    <div style={{display:'flex',gap:14,padding:'14px 16px',borderRadius:10,background:bg,border:`1px solid ${color}22`,marginBottom:8}}>
      <div style={{width:32,height:32,borderRadius:8,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color,flexShrink:0,fontWeight:700}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:700}}>{item.campaign}</span>
          <Badge type={item.type==='scale'?'g':item.type==='pause'?'r':item.type==='watch'?'w':item.type==='new'?'l':'v'}>{item.type.toUpperCase()}</Badge>
          {item.roas && <span style={{...mono,fontSize:10,color:'#555560'}}>ROAS {item.roas}×</span>}
          {item.freq && <span style={{...mono,fontSize:10,color:parseFloat(item.freq)>=4.5?C.coral:C.amber}}>freq {item.freq}</span>}
        </div>
        <div style={{...mono,fontSize:11,color:'#9898a8',lineHeight:1.6}}>{item.action}</div>
        {item.why && <div style={{...mono,fontSize:10,color:color,marginTop:5}}>Why: {item.why}</div>}
      </div>
    </div>
  )
}

export default function App() {
  const [tab,setTab]=useState('checklist')
  const [data,setData]=useState({meta:null,google:null})
  const [briefing,setBriefing]=useState(null)
  const [checklist,setChecklist]=useState(null)
  const [creativeData,setCreativeData]=useState(null)
  const [creativeImages,setCreativeImages]=useState([])
  const [loading,setLoading]=useState(false)
  const [checklistLoading,setChecklistLoading]=useState(false)
  const [creativeLoading,setCreativeLoading]=useState(false)
  const [loadingMsg,setLoadingMsg]=useState('')
  const [chatHistory,setChatHistory]=useState([])
  const [chatInput,setChatInput]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const [error,setError]=useState('')
  const [showClear,setShowClear]=useState(false)
  const [pdfLoading,setPdfLoading]=useState(false)
  const [funnelParsed,setFunnelParsed]=useState(null)
  const [channels,setChannels]=useState(null)
  // Funnel.io state
  const [nmpds,setNmpds]=useState('2.46')
  const [roasOverall,setRoasOverall]=useState('6.92')
  const [mediaSpend,setMediaSpend]=useState('13800')
  const [totalSales,setTotalSales]=useState('318000')
  const [attributedSales,setAttributedSales]=useState('95500')
  const [sessions,setSessions]=useState('142000')
  const [fClicks,setFClicks]=useState('52200')
  const [impressions,setImpressions]=useState('1710000')
  const [dateRange,setDateRange]=useState('Last 7 days')
  const chatRef=useRef(null)
  const msgInterval=useRef(null)
  const hasData=Object.values(data).some(v=>v)
  const hasFunnel=funnelParsed!==null
  const hasAnyData=hasData||hasFunnel
  const MSGS=['Checking frequency thresholds…','Applying three-strikes kill rule…','Scoring account structure…','Evaluating creative fatigue signals…','Building your action plan…','Running 190-point audit…','Finalising checklist…']
  const inputStyle={background:'#1a1a1f',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'5px 8px',color:'#e8e8ee',...mono,fontSize:12,outline:'none'}

  const processFile=(file,channel)=>{
    console.log('processFile called', file?.name, channel)
    if(!file){alert('No file');return}
    if(!file.name.toLowerCase().endsWith('.csv')){alert('Please upload a .csv file');return}
    const reader=new FileReader()
    reader.onerror=()=>alert('Read error')
    reader.onload=e=>{
      try{
        const raw=parseCSV(e.target.result)
        console.log('rows parsed:', raw.length)
        if(!raw.length){alert('CSV empty');return}
        const hdrs=Object.keys(raw[0])
        console.log('headers:', hdrs.slice(0,5).join(', '))
        const ch=channel==='auto'?detectChannel(hdrs):channel
        console.log('channel:', ch)
        const rows=ch==='meta'?normalizeMeta(raw):normalizeGoogle(raw)
        console.log('campaigns with spend:', rows.length)
        if(!rows.length){alert('No campaigns with spend found. Columns: '+hdrs.slice(0,5).join(', '));return}
        setData(prev=>({...prev,[ch]:{rows,file:file.name,loaded:new Date().toLocaleTimeString()}}))
        console.log('setData called successfully')
      }catch(err){alert('Error: '+err.message);console.error(err)}
    }
    reader.readAsText(file)
  }
  const handleFunnelPDF=async(file)=>{
    if(!file||!file.name.endsWith('.pdf')){alert('Please upload a PDF file');return}
    setPdfLoading(true);setError('')
    try{
      const parsed=await parseFunnelPDF(file)
      setFunnelParsed(parsed)
      if(parsed.overall.nmpds)setNmpds(parsed.overall.nmpds)
      if(parsed.overall.roas)setRoasOverall(parsed.overall.roas)
      if(parsed.overall.mediaSpend)setMediaSpend(parsed.overall.mediaSpend)
      if(parsed.overall.totalSales)setTotalSales(parsed.overall.totalSales)
      if(parsed.overall.attributedSales)setAttributedSales(parsed.overall.attributedSales)
      if(parsed.overall.impressions)setImpressions(parsed.overall.impressions)
      if(parsed.overall.sessions)setSessions(parsed.overall.sessions)
      if(parsed.overall.clicks)setFClicks(parsed.overall.clicks)
      if(parsed.dateRange)setDateRange(parsed.dateRange)
      if(parsed.channels)setChannels(parsed.channels)
    }catch(err){setError('PDF parse failed: '+err.message+'. Try exporting the PDF again from Funnel.io.')}
    setPdfLoading(false)
  }

  const clearData=(channel)=>{
    if(channel==='all'){
      setData({meta:null,google:null});setBriefing(null);setChecklist(null)
      setCreativeData(null);setCreativeImages([]);setChatHistory([])
      setFunnelParsed(null);setChannels(null);setError('')
    } else setData(prev=>({...prev,[channel]:null}))
  }

  const buildFunnelSummary=()=>{
    let s=`FUNNEL.IO (${dateRange}, 7-day lookback attribution, all channels blended):
- NMPDS: $${nmpds} — for every $1 spent, $${nmpds} net returned after all costs
- Blended ROAS (all channels): ${roasOverall}x
- Media Spend: $${parseFloat(mediaSpend||0).toLocaleString()}
- Total Sales: $${parseFloat(totalSales||0).toLocaleString()}
- Attributed Sales: $${parseFloat(attributedSales||0).toLocaleString()}
- Sessions: ${parseFloat(sessions||0).toLocaleString()}
- Clicks: ${parseFloat(fClicks||0).toLocaleString()}
- Impressions: ${parseFloat(impressions||0).toLocaleString()}
- Break-even ROAS: 5.0x
- Scale threshold: ROAS > 6.5x AND NMPDS > $2.00`
    if(channels){
      s+='\n\nGA4 CHANNEL BREAKDOWN (actual revenue per channel, not platform-reported):'
      if(channels.googlePMax) s+=`\n- Google PMax: ${channels.googlePMax.transactions} transactions, $${channels.googlePMax.revenue?.toLocaleString()} revenue, $${channels.googlePMax.cost?.toLocaleString()} spend → ${(channels.googlePMax.revenue/channels.googlePMax.cost).toFixed(2)}x GA4 ROAS`
      if(channels.metaPaid) s+=`\n- Meta Paid: ${channels.metaPaid.transactions} transactions, $${channels.metaPaid.revenue?.toLocaleString()} revenue, $${channels.metaPaid.cost?.toLocaleString()} spend → ${(channels.metaPaid.revenue/channels.metaPaid.cost).toFixed(2)}x GA4 ROAS (NOTE: Meta self-reports much higher — GA4 is the true number)`
      if(channels.organicSearch) s+=`\n- Organic Search: ${channels.organicSearch.transactions} transactions, $${channels.organicSearch.revenue?.toLocaleString()} revenue (unpaid)`
      if(channels.email) s+=`\n- Email: ${channels.email.transactions} transactions, $${channels.email.revenue?.toLocaleString()} revenue (unpaid)`
      if(channels.youtube) s+=`\n- YouTube organic: ${channels.youtube.transactions} transactions, $${channels.youtube.revenue?.toLocaleString()} revenue (unpaid — Jonathan's channel)`
      if(channels.direct) s+=`\n- Direct: ${channels.direct.transactions} transactions, $${channels.direct.revenue?.toLocaleString()} revenue (unpaid)`
    }
    return s
  }

  const callAPI=async(system,messages,maxTokens=2200)=>{
    const res=await fetch(`${API_URL}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system,messages,max_tokens:maxTokens})})
    if(!res.ok){const err=await res.json().catch(()=>({error:'Server error'}));throw new Error(err.error||`Error ${res.status}`)}
    const result=await res.json()
    return result.content?.[0]?.text||''
  }

  // ── WEEKLY CHECKLIST ──────────────────────────────────────
  const CHECKLIST_SYSTEM=`You are a senior paid media buyer for KM Tools (DTC woodworking tools, Shopify, ~$10K/month ad spend, break-even ROAS = 5x, scale zone ROAS > 6.5x).

Your job is to produce a simple weekly action checklist — NOT a long report. Maximum 6-8 items. Each item tells the user exactly what to do this week, in plain English, no jargon.

Item types:
- scale: campaign is profitable and should have budget increased
- hold: campaign is healthy, leave it alone
- watch: something is trending wrong, monitor closely
- pause: campaign is losing money or has hit the three-strikes rule, pause it
- creative: creative fatigue detected, new ads needed
- budget: move budget from one place to another
- new: suggest a new ad set or campaign to test

RULES:
- If ROAS > 6.5x AND frequency < 4.5 → scale
- If ROAS 5-6.5x AND frequency < 4.5 → hold
- If frequency >= 4.5 → creative (rotate now) regardless of ROAS
- If frequency >= 5.5 → pause creative + watch campaign
- If ROAS < 5x → pause or watch
- If Meta GA4 ROAS << Meta reported ROAS, flag this gap explicitly
- If Google PMax ROAS > 8x, recommend scaling it
- Always check if there is a prospecting gap (no cold audience campaign)
- Budget moves: always use 20% increments, reference specific dollar amounts

Return ONLY valid JSON:
{
  "weekOf": "date range string",
  "summary": "2 sentences max. What happened this week and the single most important thing to do.",
  "items": [
    {
      "type": "scale|hold|watch|pause|creative|budget|new",
      "campaign": "campaign name or 'Overall Account'",
      "action": "Exactly what to do. Be specific. e.g. 'Increase daily budget from $230 to $276 (20% increase). Do not change anything else.'",
      "why": "One sentence explanation a beginner would understand",
      "roas": "number or null",
      "freq": "number or null"
    }
  ],
  "biggestWin": "The one thing that would make the biggest positive difference this week",
  "watchOut": "The one risk that could hurt performance this week if ignored"
}`


  const repairJSON = (txt) => {
    // Strip markdown fences
    let s = txt.replace(/```json\n?|```\n?/g, '').trim()
    // If truncated, try to close open structures
    if (!s.endsWith('}')) {
      // Close any open arrays
      const openArrays = (s.match(/\[/g)||[]).length - (s.match(/\]/g)||[]).length
      const openObjects = (s.match(/\{/g)||[]).length - (s.match(/\}/g)||[]).length
      // Remove trailing comma or incomplete field
      s = s.replace(/,\s*$/, '').replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '')
      for (let i = 0; i < openArrays; i++) s += ']'
      for (let i = 0; i < openObjects; i++) s += '}'
    }
    return s
  }

  const runChecklist=async()=>{
    if(!hasAnyData)return
    setChecklistLoading(true);setError('');setChecklist(null)
    let mi=0;setLoadingMsg(MSGS[0])
    msgInterval.current=setInterval(()=>{mi++;setLoadingMsg(MSGS[mi%MSGS.length])},1800)
    try{
      const summary=(hasData?buildDataSummary(data,nmpds,roasOverall):'')+'\n\n'+buildFunnelSummary()
      const txt=await callAPI(CHECKLIST_SYSTEM,[{role:'user',content:summary+'\n\nGenerate my weekly action checklist.'}],3000)
      setChecklist(JSON.parse(repairJSON(txt)))
    }catch(err){setError('Checklist failed: '+err.message)}
    clearInterval(msgInterval.current);setChecklistLoading(false)
  }

  // ── FULL BRIEFING ─────────────────────────────────────────
  const runBriefing=async()=>{
    if(!hasAnyData)return
    setLoading(true);setError('');setBriefing(null)
    let mi=0;setLoadingMsg(MSGS[0])
    msgInterval.current=setInterval(()=>{mi++;setLoadingMsg(MSGS[mi%MSGS.length])},2200)
    try{
      const summary=(hasData?buildDataSummary(data,nmpds,roasOverall):'')+'\n\n'+buildFunnelSummary()
      const txt=await callAPI(MEDIA_BUYER_SYSTEM,[{role:'user',content:summary+'\n\nGenerate a full media buyer briefing.'}],2200)
      setBriefing(JSON.parse(repairJSON(txt)))
    }catch(err){setError('Analysis failed: '+err.message)}
    clearInterval(msgInterval.current);setLoading(false)
  }

  // ── CREATIVE ─────────────────────────────────────────────
  const runCreative=async()=>{
    if(!data.meta&&creativeImages.length===0)return
    setCreativeLoading(true);setCreativeData(null)
    const metaSum=data.meta?data.meta.rows.map(r=>`- "${r.name}": ROAS ${r.roas.toFixed(2)}x, Freq ${r.frequency.toFixed(2)}, CPM $${r.cpm.toFixed(2)}, Spend $${r.spend.toFixed(0)}, Purchases ${r.purchases}`).join('\n'):'No Meta campaign data'
    try{
      let messages
      if(creativeImages.length>0){
        const imageContents=await Promise.all(creativeImages.map(async img=>({type:'image',source:{type:'base64',media_type:img.type,data:await imageToBase64(img)}})))
        messages=[{role:'user',content:[...imageContents,{type:'text',text:`Analyze these ${creativeImages.length} ad creative(s) for KM Tools (woodworking tools, target: male 30-55 DIY/semi-pro woodworker).\n\nFor each evaluate: hook strength (problem/product clear in first frame?), copy clarity, format fit, authenticity (UGC vs polished), CTA, overall score 1-10.\n\nCampaign data:\n${metaSum}\n\n${buildFunnelSummary()}\n\nReturn ONLY valid JSON:\n{"visualAnalysis":[{"creativeIndex":number,"hookStrength":"Weak|OK|Strong","hookNote":"first frame assessment","copyNote":"text overlay assessment","formatFit":"Poor|OK|Good","overallScore":number,"topIssue":"biggest problem","topStrength":"biggest strength","recommendation":"specific action"}],"fatigueAssessment":[{"campaign":"name","frequency":number,"status":"OK|Watch|Warning|Critical","action":"specific action"}],"hookAngles":[{"angle":"name","hook":"exact opening line","why":"why this works for woodworking buyers"}],"creativeBriefs":[{"title":"name","format":"Static Image|Short Video|UGC|Carousel|Reels","hook":"first 3 seconds","visual":"what to show","cta":"call to action","audience":"Cold|Warm|Retargeting","priority":"HIGH|MEDIUM"}]}`}]}]
      }else{
        messages=[{role:'user',content:`Meta campaign data:\n${metaSum}\n\n${buildFunnelSummary()}\n\nAnalyze creative fatigue and generate briefs for woodworking tools audience.`}]
      }
      const txt=await callAPI(CREATIVE_SYSTEM,messages,1800)
      setCreativeData(JSON.parse(txt.replace(/```json\n?|```\n?/g,'').trim()))
    }catch(err){setError('Creative analysis failed: '+err.message)}
    setCreativeLoading(false)
  }

  // ── CHAT ─────────────────────────────────────────────────
  const sendChat=async()=>{
    if(!chatInput.trim()||chatLoading)return
    const msg=chatInput.trim();setChatInput('')
    setChatHistory(prev=>[...prev,{role:'user',content:msg}])
    setChatLoading(true)
    try{
      const context=`DATA:\n${hasData?buildDataSummary(data,nmpds,roasOverall):''}\n\n${buildFunnelSummary()}\n\nCHECKLIST SUMMARY:\n${checklist?.summary||briefing?.execSummary||'None yet'}\n\nQUESTION: ${msg}`
      const txt=await callAPI(CHAT_SYSTEM,[{role:'user',content:context}],700)
      setChatHistory(prev=>[...prev,{role:'assistant',content:txt}])
    }catch(err){setChatHistory(prev=>[...prev,{role:'assistant',content:'Error: '+err.message}])}
    setChatLoading(false)
    setTimeout(()=>chatRef.current?.scrollTo(0,chatRef.current.scrollHeight),100)
  }

  const allRows=[...(data.meta?.rows||[]),...(data.google?.rows||[])]
  const totalSpend=allRows.reduce((s,r)=>s+r.spend,0)
  const totalConv=allRows.reduce((s,r)=>s+(r.purchases||r.conversions||0),0)
  const blendedRoas=allRows.reduce((s,r)=>s+r.roas*r.spend,0)/(totalSpend||1)
  const primaryRows=data.meta?.rows||data.google?.rows||[]
  const gradeColor=g=>({A:C.teal,B:'#639922',C:C.amber,D:C.coral,F:C.coral}[g]||'#555')
  const gradeLabel=g=>({A:'Excellent',B:'Good',C:'Needs work',D:'Issues present',F:'Urgent'}[g]||'')

  const tabs=[
    {id:'checklist',label:'✅ Weekly Checklist'},
    {id:'dashboard',label:'Dashboard'},
    {id:'analysis',label:'AI Deep Dive'},
    {id:'data',label:'Data Sources'},
    {id:'creative',label:'Creative'},
  ]

  return (
    <div style={{background:'#080809',minHeight:'100vh',color:'#e8e8ee',fontFamily:"'Epilogue', sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e1e22;border-radius:2px}`}</style>

      {/* TOPBAR */}
      <div style={{height:50,borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',padding:'0 24px',gap:12,background:'rgba(8,8,9,0.98)',position:'sticky',top:0,zIndex:100}}>
        <div style={{width:26,height:26,background:C.accent,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#000'}}>KM</div>
        <span style={{fontSize:12,fontWeight:800,letterSpacing:'0.08em',textTransform:'uppercase'}}>AI Media Buyer</span>
        <span style={{...mono,fontSize:9,background:'#1a1a1f',border:'1px solid rgba(255,255,255,0.1)',color:'#666',padding:'2px 7px',borderRadius:20}}>2026</span>
        <div style={{marginLeft:'auto',display:'flex',gap:12,alignItems:'center'}}>
          {hasFunnel&&<span style={{...mono,fontSize:10,color:C.accent,display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:C.accent}}/>Funnel.io {dateRange}</span>}
          {hasData&&<span style={{...mono,fontSize:10,color:C.teal,display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:C.teal}}/>CSV loaded</span>}
          {hasAnyData&&(
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowClear(true)} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:5,padding:'3px 10px',cursor:'pointer'}}>Clear all</button>
              {showClear&&(
                <div style={{position:'absolute',right:0,top:32,background:'#1a1a1f',border:'1px solid rgba(255,77,77,0.4)',borderRadius:8,padding:'12px 16px',whiteSpace:'nowrap',zIndex:200}}>
                  <div style={{...mono,fontSize:11,color:'#e8e8ee',marginBottom:10}}>Clear all data?</div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{clearData('all');setShowClear(false)}} style={{...mono,fontSize:11,background:C.coral,border:'none',color:'#fff',borderRadius:5,padding:'5px 12px',cursor:'pointer'}}>Yes, clear</button>
                    <button onClick={()=>setShowClear(false)} style={{...mono,fontSize:11,background:'transparent',border:'1px solid rgba(255,255,255,0.15)',color:'#888',borderRadius:5,padding:'5px 12px',cursor:'pointer'}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <span style={{...mono,fontSize:10,color:'#444'}}>Break-even 5×</span>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f12',padding:'0 24px',overflowX:'auto'}}>
        {tabs.map(t=><div key={t.id} onClick={()=>setTab(t.id)} style={{padding:'11px 16px',fontSize:12,fontWeight:600,color:tab===t.id?'#e8e8ee':'#555560',cursor:'pointer',borderBottom:tab===t.id?`2px solid ${C.accent}`:'2px solid transparent',whiteSpace:'nowrap',transition:'all 0.15s'}}>{t.label}</div>)}
      </div>

      <div style={{padding:'20px 24px',maxWidth:1200}}>
        {error&&<div style={{background:'rgba(255,107,91,0.1)',border:'1px solid rgba(255,107,91,0.3)',borderRadius:8,padding:'12px 16px',marginBottom:14,...mono,fontSize:11,color:C.coral,display:'flex',justifyContent:'space-between',alignItems:'center'}}>{error}<button onClick={()=>setError('')} style={{background:'none',border:'none',color:C.coral,cursor:'pointer',fontSize:18,lineHeight:1}}>×</button></div>}

        {/* ══ WEEKLY CHECKLIST ══ */}
        {tab==='checklist'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div>
                <div style={{fontSize:20,fontWeight:800}}>Weekly Checklist</div>
                <div style={{...mono,fontSize:10,color:'#555560',marginTop:3}}>What to do this week — plain English, no jargon</div>
              </div>
              <button disabled={!hasAnyData||checklistLoading} onClick={runChecklist}
                style={{fontFamily:'inherit',fontSize:13,fontWeight:800,padding:'10px 24px',borderRadius:8,border:'none',cursor:!hasAnyData||checklistLoading?'not-allowed':'pointer',background:!hasAnyData||checklistLoading?'#1a1a1f':C.accent,color:!hasAnyData||checklistLoading?'#444':'#000',display:'flex',alignItems:'center',gap:8,transition:'all 0.15s'}}>
                {checklistLoading?<><Spinner color={C.accent}/><span style={{color:C.accent}}>{loadingMsg}</span></>:checklist?'🔄 Refresh':'✅ Generate My Checklist'}
              </button>
            </div>

            {/* Import strip — always visible at top of checklist */}
            {!hasAnyData&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                <Card style={{borderColor:'rgba(200,241,53,0.2)',background:'#0d0d10'}}>
                  <CardHead color={C.accent}>Step 1 — Drop your Funnel.io PDF</CardHead>
                  <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:10}}>Export your weekly PDF from Funnel.io → drag it here → all metrics auto-populate.</div>
                  {pdfLoading
                    ?<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent,padding:'12px 0'}}><Spinner color={C.accent}/>Parsing PDF…</div>
                    :<UploadZone channel="funnel" onFile={(f)=>handleFunnelPDF(f)} label="Drop Funnel.io PDF" hint="Weekly export · All metrics auto-populate" accept=".pdf"/>
                  }
                </Card>
                <Card>
                  <CardHead>Step 2 — Drop your Meta CSV</CardHead>
                  <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:10}}>Ads Manager → Campaigns → set date range → Export CSV</div>
                  <UploadZone channel="meta" onFile={processFile} label="Drop Meta campaign CSV" hint="Campaign-level export"/>
                </Card>
              </div>
            )}

            {!hasAnyData&&(
              <div style={{textAlign:'center',padding:'40px 20px',color:'#555560'}}>
                <div style={{fontSize:32,marginBottom:12,opacity:0.4}}>✅</div>
                <div style={{fontSize:14,fontWeight:700,color:'#e8e8ee',marginBottom:8}}>Import data to generate your checklist</div>
                <div style={{...mono,fontSize:11,lineHeight:1.8}}>Drop your Funnel.io PDF and Meta CSV above.<br/>The checklist tells you exactly what to do each week in plain English.</div>
              </div>
            )}

            {hasAnyData&&!checklist&&!checklistLoading&&(
              <div>
                {/* Show import options even when data is loaded */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <Card style={{borderColor:hasFunnel?'rgba(200,241,53,0.2)':'rgba(255,255,255,0.07)',background:'#0d0d10'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <CardHead color={hasFunnel?C.accent:'#555560'} style={{marginBottom:0}}>Funnel.io PDF</CardHead>
                      {hasFunnel&&<Badge type="g">Loaded · {dateRange}</Badge>}
                    </div>
                    {hasFunnel
                      ?<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.8}}>
                        NMPDS ${nmpds} · ROAS {roasOverall}× · Spend ${parseFloat(mediaSpend||0).toLocaleString()}<br/>
                        {channels?.googlePMax&&`Google PMax: ${channels.googlePMax.transactions} tx · ${(channels.googlePMax.revenue/channels.googlePMax.cost).toFixed(1)}× GA4 ROAS`}<br/>
                        {channels?.metaPaid&&`Meta Paid: ${channels.metaPaid.transactions} tx · ${(channels.metaPaid.revenue/channels.metaPaid.cost).toFixed(1)}× GA4 ROAS`}
                        <div style={{marginTop:8}}><UploadZone channel="funnel" onFile={(f)=>handleFunnelPDF(f)} label="Replace PDF" hint="" compact accept=".pdf"/></div>
                      </div>
                      :<div>{pdfLoading?<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent,padding:'8px 0'}}><Spinner color={C.accent}/>Parsing…</div>:<UploadZone channel="funnel" onFile={(f)=>handleFunnelPDF(f)} label="Drop Funnel.io PDF" hint="Auto-populates all metrics" accept=".pdf"/>}</div>
                    }
                  </Card>
                  <Card style={{borderColor:data.meta?'rgba(0,224,176,0.2)':'rgba(255,255,255,0.07)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <CardHead color={data.meta?C.teal:'#555560'} style={{marginBottom:0}}>Meta CSV</CardHead>
                      {data.meta&&<Badge type="g">Loaded · {data.meta.rows.length} campaigns</Badge>}
                    </div>
                    {data.meta
                      ?<div style={{...mono,fontSize:10,color:'#9898a8',marginBottom:8}}>
                        {data.meta.rows.map(r=>`${r.name.slice(0,28)}: ${r.roas.toFixed(1)}× ROAS, freq ${r.frequency.toFixed(1)}`).join('\n')}
                        <div style={{marginTop:8}}><UploadZone channel="meta" onFile={processFile} label="Replace CSV" hint="" compact/></div>
                      </div>
                      :<UploadZone channel="meta" onFile={processFile} label="Drop Meta CSV" hint="Ads Manager campaign export"/>
                    }
                  </Card>
                </div>
                <div style={{textAlign:'center',padding:'20px'}}>
                  <button onClick={runChecklist} style={{fontFamily:'inherit',fontSize:14,fontWeight:800,padding:'14px 36px',borderRadius:10,border:'none',cursor:'pointer',background:C.accent,color:'#000'}}>✅ Generate My Checklist</button>
                </div>
              </div>
            )}

            {checklist&&(
              <div>
                {/* Import strip — collapsed but accessible */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <Card style={{borderColor:hasFunnel?'rgba(200,241,53,0.15)':'rgba(255,255,255,0.07)',background:'#0d0d10',padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <span style={{...mono,fontSize:9,color:hasFunnel?C.accent:'#555560',textTransform:'uppercase',letterSpacing:'0.1em'}}>Funnel.io PDF</span>
                      {hasFunnel?<Badge type="l">{dateRange}</Badge>:<Badge type="r">Not loaded</Badge>}
                    </div>
                    {pdfLoading?<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent}}><Spinner color={C.accent}/>Parsing…</div>:<UploadZone channel="funnel" onFile={(f)=>handleFunnelPDF(f)} label={hasFunnel?'Replace PDF':'Drop Funnel.io PDF'} hint="" compact accept=".pdf"/>}
                  </Card>
                  <Card style={{borderColor:data.meta?'rgba(0,224,176,0.15)':'rgba(255,255,255,0.07)',padding:'14px 16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <span style={{...mono,fontSize:9,color:data.meta?C.teal:'#555560',textTransform:'uppercase',letterSpacing:'0.1em'}}>Meta CSV</span>
                      {data.meta?<Badge type="g">{data.meta.rows.length} campaigns</Badge>:<Badge type="r">Not loaded</Badge>}
                    </div>
                    <UploadZone channel="meta" onFile={processFile} label={data.meta?'Replace CSV':'Drop Meta CSV'} hint="" compact/>
                  </Card>
                </div>

                {/* Summary banner */}
                <div style={{background:'rgba(200,241,53,0.06)',border:'1px solid rgba(200,241,53,0.2)',borderRadius:12,padding:'16px 20px',marginBottom:14}}>
                  <div style={{...mono,fontSize:9,color:C.accent,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Week of {checklist.weekOf}</div>
                  <div style={{fontSize:14,fontWeight:600,lineHeight:1.6,marginBottom:12}}>{checklist.summary}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div style={{background:'rgba(0,224,176,0.07)',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{...mono,fontSize:9,color:C.teal,marginBottom:4}}>BIGGEST WIN THIS WEEK</div>
                      <div style={{fontSize:12,lineHeight:1.5}}>{checklist.biggestWin}</div>
                    </div>
                    <div style={{background:'rgba(255,178,36,0.07)',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{...mono,fontSize:9,color:C.amber,marginBottom:4}}>WATCH OUT FOR</div>
                      <div style={{fontSize:12,lineHeight:1.5}}>{checklist.watchOut}</div>
                    </div>
                  </div>
                </div>

                {/* Checklist items */}
                <div style={{marginBottom:14}}>
                  {(checklist.items||[]).map((item,i)=><CheckItem key={i} item={item}/>)}
                </div>

                {/* Channel truth table if PDF loaded */}
                {channels&&(channels.googlePMax||channels.metaPaid)&&(
                  <Card>
                    <CardHead>GA4 reality check — what each channel actually drove</CardHead>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead><tr>
                          {['Channel','Transactions','Revenue','Ad Spend','GA4 ROAS','vs Platform'].map(h=>(
                            <th key={h} style={{...mono,fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#555560',padding:'8px 10px',borderBottom:'1px solid rgba(255,255,255,0.06)',textAlign:'left',fontWeight:500}}>{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[
                            channels.googlePMax&&{name:'Google PMax',tx:channels.googlePMax.transactions,rev:channels.googlePMax.revenue,cost:channels.googlePMax.cost,platform:parseFloat(roasOverall)},
                            channels.metaPaid&&{name:'Meta Paid',tx:channels.metaPaid.transactions,rev:channels.metaPaid.revenue,cost:channels.metaPaid.cost,platform:data.meta?.rows?.[0]?.roas||null},
                            channels.organicSearch&&{name:'Organic Search',tx:channels.organicSearch.transactions,rev:channels.organicSearch.revenue,cost:0,platform:null},
                            channels.email&&{name:'Email',tx:channels.email.transactions,rev:channels.email.revenue,cost:0,platform:null},
                            channels.youtube&&{name:'YouTube (organic)',tx:channels.youtube.transactions,rev:channels.youtube.revenue,cost:0,platform:null},
                            channels.direct&&{name:'Direct',tx:channels.direct.transactions,rev:channels.direct.revenue,cost:0,platform:null},
                          ].filter(Boolean).map((ch,i)=>{
                            const ga4Roas=ch.cost>0?ch.rev/ch.cost:null
                            const gap=ga4Roas&&ch.platform?((ch.platform-ga4Roas)/ch.platform*100).toFixed(0):null
                            const td={padding:'9px 10px',borderBottom:'1px solid rgba(255,255,255,0.04)'}
                            return(
                              <tr key={i}>
                                <td style={{...td,fontWeight:600,fontSize:12}}>{ch.name}</td>
                                <td style={{...td,...mono}}>{ch.tx}</td>
                                <td style={{...td,...mono}}>${ch.rev?.toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                                <td style={{...td,...mono}}>{ch.cost>0?'$'+ch.cost.toLocaleString('en-US',{maximumFractionDigits:0}):'—'}</td>
                                <td style={{...td,...mono,color:ga4Roas>=6.5?C.teal:ga4Roas>=5?C.amber:ga4Roas>0?C.coral:'#555560'}}>{ga4Roas?ga4Roas.toFixed(2)+'×':'—'}</td>
                                <td style={{...td,...mono,fontSize:10,color:gap>30?C.coral:gap>10?C.amber:C.teal}}>
                                  {gap?`Platform reports ${gap}% higher`:ch.cost===0?'Unpaid channel':'—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{...mono,fontSize:10,color:'#444',marginTop:10,lineHeight:1.7}}>GA4 ROAS = what Google Analytics actually attributed. Platform ROAS = what Meta/Google claim. The gap is normal — Meta over-credits due to view-through attribution. Use GA4 for budget decisions.</div>
                  </Card>
                )}

                {/* Ask button → deep dive */}
                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
                  <button onClick={()=>{setTab('analysis');setTimeout(runBriefing,100)}} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'9px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'#9898a8',cursor:'pointer'}}>Full AI briefing →</button>
                  <button onClick={()=>setTab('creative')} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'9px 18px',borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',background:'transparent',color:'#9898a8',cursor:'pointer'}}>Creative analysis →</button>
                </div>

                {/* Chat */}
                <Card>
                  <CardHead>Ask a follow-up question</CardHead>
                  <div ref={chatRef} style={{maxHeight:280,overflowY:'auto',marginBottom:12}}>
                    {chatHistory.length===0&&<div style={{...mono,fontSize:11,color:'#444',padding:'8px 0'}}>e.g. "How do I increase my Product Sets ASC budget?" · "What does frequency mean?" · "Should I pause Catalog Conv?"</div>}
                    {chatHistory.map((m,i)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{...mono,fontSize:9,color:m.role==='user'?'#555560':C.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>{m.role==='user'?'You':'Media Buyer'}</div>
                        <div style={{...mono,fontSize:11,color:m.role==='user'?'#e8e8ee':'#9898a8',lineHeight:1.7,borderLeft:m.role==='assistant'?`2px solid ${C.accent}`:'none',paddingLeft:m.role==='assistant'?12:0,whiteSpace:'pre-wrap'}}>{m.content}</div>
                      </div>
                    ))}
                    {chatLoading&&<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent}}><Spinner color={C.accent}/>Thinking…</div>}
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}} placeholder="Ask anything about your campaigns…" style={{flex:1,background:'#161619',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'10px 14px',color:'#e8e8ee',...mono,fontSize:12,resize:'none',minHeight:42,maxHeight:100,outline:'none'}}/>
                    <button onClick={sendChat} disabled={chatLoading} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'10px 16px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000',flexShrink:0}}>Ask ↗</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ══ DASHBOARD ══ */}
        {tab==='dashboard'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div><div style={{fontSize:20,fontWeight:800}}>Dashboard</div><div style={{...mono,fontSize:10,color:'#555560',marginTop:3}}>Funnel.io + CSV · {dateRange}</div></div>
            </div>
            <Card style={{borderColor:'rgba(200,241,53,0.2)',background:'#0d0d10'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{...mono,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:C.accent}}>Funnel.io actuals</div>
                  {hasFunnel&&<Badge type="l">{dateRange}</Badge>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {pdfLoading&&<div style={{display:'flex',gap:6,alignItems:'center',...mono,fontSize:10,color:C.accent}}><Spinner color={C.accent}/>Parsing PDF…</div>}
                  <label style={{cursor:'pointer',display:'flex',alignItems:'center',gap:6,...mono,fontSize:11,color:C.accent,border:`1px solid ${C.accent}30`,borderRadius:6,padding:'4px 10px'}}>
                    📄 {hasFunnel?'Replace PDF':'Import PDF'}
                    <input type="file" accept=".pdf" onChange={e=>{if(e.target.files[0])handleFunnelPDF(e.target.files[0])}} style={{display:'none'}}/>
                  </label>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                <MetricCard label="NMPDS" value={`$${nmpds}`} sub={parseFloat(nmpds)>=2?'↑ Scale zone':parseFloat(nmpds)>=1?'~ Optimize':'↓ Watch'} color={parseFloat(nmpds)>=2?C.teal:parseFloat(nmpds)>=1?C.amber:C.coral}/>
                <MetricCard label="Blended ROAS" value={`${roasOverall}×`} sub={parseFloat(roasOverall)>=6.5?'↑ Scale zone':parseFloat(roasOverall)>=5?'~ Profitable':'↓ Below break-even'} color={parseFloat(roasOverall)>=6.5?C.teal:parseFloat(roasOverall)>=5?C.amber:C.coral}/>
                <MetricCard label="Media spend" value={'$'+parseFloat(mediaSpend||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub={dateRange}/>
                <MetricCard label="Total sales" value={'$'+parseFloat(totalSales||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub="7-day lookback"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                <MetricCard label="Attributed sales" value={'$'+parseFloat(attributedSales||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub="Ad-attributed"/>
                <MetricCard label="Impressions" value={(parseFloat(impressions||0)/1000000).toFixed(2)+'M'} sub="All channels"/>
                <MetricCard label="Sessions" value={(parseFloat(sessions||0)/1000).toFixed(1)+'K'} sub="Site visits"/>
                <MetricCard label="Clicks" value={(parseFloat(fClicks||0)/1000).toFixed(1)+'K'} sub="Ad clicks"/>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                <span style={{...mono,fontSize:10,color:'#555'}}>Manual update:</span>
                {[['NMPDS $',nmpds,setNmpds,68],['ROAS',roasOverall,setRoasOverall,58],['Spend $',mediaSpend,setMediaSpend,90],['Total $',totalSales,setTotalSales,90],['Att. $',attributedSales,setAttributedSales,90],['Impr.',impressions,setImpressions,90],['Sessions',sessions,setSessions,80],['Clicks',fClicks,setFClicks,80]].map(([label,val,setter,w])=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{...mono,fontSize:10,color:'#555'}}>{label}</span>
                    <input value={val} onChange={e=>setter(e.target.value)} style={{...inputStyle,width:w,fontSize:11,padding:'4px 6px'}}/>
                  </div>
                ))}
              </div>
            </Card>

            {!hasData?(
              <div style={{textAlign:'center',padding:'32px 20px'}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>Import ad platform CSVs</div>
                <div style={{...mono,fontSize:11,color:'#666',lineHeight:1.8,marginBottom:14}}>Go to Data Sources to import Meta and Google Ads exports</div>
                <button onClick={()=>setTab('data')} style={{fontFamily:'inherit',fontSize:13,fontWeight:700,padding:'10px 24px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000'}}>Go to Data Sources</button>
              </div>
            ):(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                  <MetricCard label="CSV total spend" value={'$'+totalSpend.toLocaleString('en-US',{maximumFractionDigits:0})} sub="Loaded channels"/>
                  <MetricCard label="Conversions" value={totalConv.toLocaleString()} sub="Platform data"/>
                  <MetricCard label="Platform ROAS" value={blendedRoas.toFixed(2)+'×'} sub="CSV blended" color={blendedRoas>=6.5?C.teal:blendedRoas>=5?C.amber:C.coral}/>
                  <MetricCard label="Campaigns" value={primaryRows.length} sub={Object.entries(data).filter(([,v])=>v).map(([k])=>k).join(' · ')}/>
                </div>
                <Card><CardHead>Campaigns</CardHead><CampaignTable rows={primaryRows} channel={data.meta?'meta':'google'}/></Card>
                <div style={{background:'linear-gradient(135deg,rgba(200,241,53,0.07),rgba(139,111,255,0.07))',border:'1px solid rgba(200,241,53,0.18)',borderRadius:12,padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
                  <div><div style={{fontSize:15,fontWeight:800,marginBottom:4}}>Generate your weekly checklist</div><div style={{...mono,fontSize:11,color:'#666'}}>Plain English actions · No jargon · 20 seconds</div></div>
                  <button onClick={()=>{setTab('checklist');setTimeout(runChecklist,100)}} style={{fontFamily:'inherit',fontSize:13,fontWeight:700,padding:'10px 24px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000'}}>✅ Generate Checklist ↗</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ AI DEEP DIVE ══ */}
        {tab==='analysis'&&(
          <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>AI Deep Dive</div>
            <div style={{...mono,fontSize:10,color:'#555560',marginBottom:20}}>Full 190-check audit · Detailed recommendations · For when you want the complete picture</div>
            <button disabled={!hasAnyData||loading} onClick={runBriefing} style={{width:'100%',padding:16,background:!hasAnyData||loading?'#1a1a1f':C.accent,color:!hasAnyData||loading?'#444':'#000',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:800,cursor:!hasAnyData||loading?'not-allowed':'pointer',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all 0.15s'}}>
              {loading?<><Spinner color={C.accent}/><span style={{color:C.accent}}>{loadingMsg}</span></>:briefing?'🔄  Re-run Deep Dive':hasAnyData?'🧠  Run Full Analysis':'Import data first'}
            </button>
            {!briefing&&!loading&&<div style={{textAlign:'center',padding:'40px 20px',color:'#555560'}}><div style={{fontSize:32,marginBottom:12,opacity:0.4}}>🧠</div><div style={{fontSize:14,fontWeight:700,color:'#e8e8ee',marginBottom:8}}>Full briefing mode</div><div style={{...mono,fontSize:11,lineHeight:1.8}}>Use the Weekly Checklist for day-to-day decisions.<br/>Use this for monthly strategic reviews.</div></div>}
            {briefing&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  <Card>
                    <CardHead>Account health score</CardHead>
                    <div style={{textAlign:'center',padding:'16px 0'}}>
                      <div style={{fontSize:52,fontWeight:900,letterSpacing:'-0.04em',color:gradeColor(briefing.healthGrade)}}>{briefing.healthScore}</div>
                      <div style={{...mono,fontSize:12,color:'#666',marginTop:4}}>Grade {briefing.healthGrade} — {gradeLabel(briefing.healthGrade)}</div>
                      <div style={{height:6,background:'#1e1e22',borderRadius:3,overflow:'hidden',marginTop:12}}><div style={{height:'100%',width:`${briefing.healthScore}%`,background:gradeColor(briefing.healthGrade),borderRadius:3,transition:'width 1s ease'}}/></div>
                    </div>
                  </Card>
                  <Card>
                    <CardHead>Dimension scores</CardHead>
                    {briefing.dimensionScores&&[['Campaign Structure','campaignStructure',20],['Creative Quality','creativeQuality',25],['Audience & Targeting','audienceTargeting',20],['Bidding & Budget','biddingBudget',15],['Tracking','tracking',10],['Account Hygiene','accountHygiene',10]].map(([l,k,m])=><ScoreBar key={k} label={l} value={briefing.dimensionScores[k]||0} max={m}/>)}
                  </Card>
                </div>
                <Card><CardHead>Executive brief</CardHead><div style={{...mono,fontSize:11,color:'#9898a8',lineHeight:1.8}}>{briefing.execSummary}</div></Card>
                <Card><CardHead>Recommendations</CardHead>{(briefing.recommendations||[]).map((r,i)=><InsightRec key={i} rec={r}/>)}</Card>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
                  <Card><CardHead color={C.teal}>Scale ↑</CardHead>{(briefing.scale||[]).length?briefing.scale.map((i,idx)=><ListItem key={idx} item={i} color={C.teal}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None</div>}</Card>
                  <Card><CardHead color={C.coral}>Pause ✕</CardHead>{(briefing.pause||[]).length?briefing.pause.map((i,idx)=><ListItem key={idx} item={i} color={C.coral}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None</div>}</Card>
                  <Card><CardHead color={C.amber}>New ad sets</CardHead>{(briefing.newAdSets||[]).length?briefing.newAdSets.map((i,idx)=><ListItem key={idx} item={i} color={C.amber}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None</div>}</Card>
                </div>
                <Card><CardHead>Creative recommendations</CardHead>{(briefing.creativeRecs||[]).map((r,i)=>(
                  <div key={i} style={{display:'flex',gap:12,padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{width:3,borderRadius:2,background:C.amber,flexShrink:0,minHeight:36,alignSelf:'stretch'}}/>
                    <div><div style={{fontSize:12,fontWeight:700,marginBottom:4,display:'flex',gap:8,alignItems:'center'}}>{r.title}<Badge type="w">{r.type}</Badge></div><div style={{...mono,fontSize:11,color:'#9898a8',lineHeight:1.7}}>{r.detail}</div></div>
                  </div>
                ))}</Card>
                <Card>
                  <CardHead>Budget moves</CardHead>
                  {(briefing.budgetMoves||[]).map((m,i)=>(
                    <div key={i} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                      <div style={{width:3,borderRadius:2,background:C.violet,flexShrink:0,minHeight:28,alignSelf:'stretch'}}/>
                      <div><div style={{fontSize:11,fontWeight:700,marginBottom:2}}>{m.amount} — {m.from} → {m.to}</div><div style={{...mono,fontSize:10,color:'#9898a8'}}>{m.reason}</div></div>
                    </div>
                  ))}
                  {briefing.positives?.length>0&&<div style={{marginTop:16}}><CardHead>What's working</CardHead>{briefing.positives.map((p,i)=><div key={i} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}><div style={{width:3,borderRadius:2,background:C.teal,flexShrink:0,minHeight:28,alignSelf:'stretch'}}/><div style={{...mono,fontSize:11,color:'#9898a8'}}>{p}</div></div>)}</div>}
                </Card>
                <Card>
                  <CardHead>Ask your media buyer</CardHead>
                  <div ref={chatRef} style={{maxHeight:300,overflowY:'auto',marginBottom:12}}>
                    {chatHistory.length===0&&<div style={{...mono,fontSize:11,color:'#444',padding:'8px 0'}}>Ask anything…</div>}
                    {chatHistory.map((m,i)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{...mono,fontSize:9,color:m.role==='user'?'#555560':C.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>{m.role==='user'?'You':'Media Buyer'}</div>
                        <div style={{...mono,fontSize:11,color:m.role==='user'?'#e8e8ee':'#9898a8',lineHeight:1.7,borderLeft:m.role==='assistant'?`2px solid ${C.accent}`:'none',paddingLeft:m.role==='assistant'?12:0,whiteSpace:'pre-wrap'}}>{m.content}</div>
                      </div>
                    ))}
                    {chatLoading&&<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent}}><Spinner color={C.accent}/>Thinking…</div>}
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}} placeholder="Ask anything about your campaigns, budget, creative…" style={{flex:1,background:'#161619',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'10px 14px',color:'#e8e8ee',...mono,fontSize:12,resize:'none',minHeight:42,maxHeight:100,outline:'none'}}/>
                    <button onClick={sendChat} disabled={chatLoading} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'10px 16px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000',flexShrink:0}}>Ask ↗</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ══ DATA SOURCES ══ */}
        {tab==='data'&&(
          <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Data Sources</div>
            <div style={{...mono,fontSize:10,color:'#555560',marginBottom:20}}>Import · Replace · Remove</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
              {/* Funnel.io PDF */}
              <Card style={{borderColor:hasFunnel?'rgba(200,241,53,0.2)':'rgba(255,255,255,0.07)',background:'#0d0d10'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <CardHead color={hasFunnel?C.accent:'#555560'} style={{marginBottom:0}}>Funnel.io PDF</CardHead>
                  {hasFunnel&&<button onClick={()=>{setFunnelParsed(null);setChannels(null)}} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>Remove</button>}
                </div>
                {hasFunnel
                  ?<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.8,marginBottom:10}}>
                    ✓ {dateRange}<br/>
                    NMPDS ${nmpds} · ROAS {roasOverall}×<br/>
                    Spend ${parseFloat(mediaSpend||0).toLocaleString()}<br/>
                    {channels?.googlePMax&&`Google PMax: ${channels.googlePMax.transactions} tx`}<br/>
                    {channels?.metaPaid&&`Meta Paid: ${channels.metaPaid.transactions} tx`}
                  </div>
                  :<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:10}}>Export from Funnel.io → PDF → drop here.<br/>Auto-populates all 8 metrics + channel table.</div>
                }
                {pdfLoading?<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent,padding:'8px 0'}}><Spinner color={C.accent}/>Parsing…</div>:<UploadZone channel="funnel" onFile={(f)=>handleFunnelPDF(f)} label={hasFunnel?'Replace PDF':'Drop Funnel.io PDF'} hint="Weekly export · .pdf" accept=".pdf"/>}
              </Card>
              {/* Meta */}
              <Card style={{borderColor:data.meta?'rgba(0,224,176,0.2)':'rgba(255,255,255,0.07)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <CardHead color={data.meta?C.teal:'#555560'} style={{marginBottom:0}}>Meta Ads CSV</CardHead>
                  {data.meta&&<button onClick={()=>clearData('meta')} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>Remove</button>}
                </div>
                {data.meta
                  ?<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.8,marginBottom:10}}>✓ {data.meta.file}<br/>{data.meta.rows.length} campaigns · {data.meta.loaded}</div>
                  :<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:10}}>Ads Manager → Campaigns → Export CSV<br/>Include: Amount spent, Purchases, ROAS, CPM, Frequency</div>
                }
                <UploadZone channel="meta" onFile={processFile} label={data.meta?'Replace CSV':'Drop Meta CSV'} hint="Campaign-level export" compact={!!data.meta}/>
              </Card>
              {/* Google */}
              <Card style={{borderColor:data.google?'rgba(0,224,176,0.2)':'rgba(255,255,255,0.07)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <CardHead color={data.google?C.teal:'#555560'} style={{marginBottom:0}}>Google Ads CSV</CardHead>
                  {data.google&&<button onClick={()=>clearData('google')} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>Remove</button>}
                </div>
                {data.google
                  ?<div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.8,marginBottom:10}}>✓ {data.google.file}<br/>{data.google.rows.length} campaigns · {data.google.loaded}</div>
                  :<div>
                    <div style={{...mono,fontSize:10,color:C.amber,marginBottom:8,lineHeight:1.6,background:'rgba(255,178,36,0.08)',padding:'8px 10px',borderRadius:6}}>Column must be named "Cost" exactly. Delete summary rows at top before importing.</div>
                    <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:10}}>Google Ads → Campaigns → Download CSV</div>
                  </div>
                }
                <UploadZone channel="google" onFile={processFile} label={data.google?'Replace CSV':'Drop Google CSV'} hint="Campaign-level export with Cost column" compact={!!data.google}/>
              </Card>
            </div>
            <Card>
              <CardHead>Weekly workflow</CardHead>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {[
                  ['1. Monday morning',C.accent,['Export weekly PDF from Funnel.io','Drop PDF into Data Sources','Export Meta CSV (last 7 days)','Drop Meta CSV into Data Sources'],'5 minutes total import time'],
                  ['2. Generate checklist',C.teal,['Go to Weekly Checklist tab','Hit Generate My Checklist','Read the summary + action items','Identify the top 2-3 things to do'],'The tool does the thinking. You make the calls.'],
                  ['3. Take action',C.amber,['Make budget changes in Meta Ads Manager','Rotate creative if freq warning','Adjust Google PMax budget if needed','Log what you did (notepad is fine)'],'Aim to action everything within 24 hours of reviewing.'],
                ].map(([title,color,items,note])=>(
                  <div key={title} style={{background:'#161619',borderRadius:8,padding:14}}>
                    <div style={{fontSize:12,fontWeight:700,color,marginBottom:10}}>{title}</div>
                    {items.map((item,i)=><div key={i} style={{...mono,fontSize:10,color:'#9898a8',marginBottom:6,display:'flex',gap:6}}><span style={{color}}>·</span>{item}</div>)}
                    <div style={{...mono,fontSize:10,color:'#444',marginTop:10,lineHeight:1.6,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:10}}>{note}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══ CREATIVE ══ */}
        {tab==='creative'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div><div style={{fontSize:20,fontWeight:800}}>Creative Analysis</div><div style={{...mono,fontSize:10,color:'#555560',marginTop:3}}>Visual scoring · Fatigue signals · Hook angles · Production briefs</div></div>
              <button disabled={(!data.meta&&creativeImages.length===0)||creativeLoading} onClick={runCreative} style={{fontFamily:'inherit',fontSize:13,fontWeight:700,padding:'9px 18px',borderRadius:8,border:'none',cursor:(!data.meta&&creativeImages.length===0)||creativeLoading?'not-allowed':'pointer',background:(!data.meta&&creativeImages.length===0)||creativeLoading?'#1a1a1f':C.accent,color:(!data.meta&&creativeImages.length===0)||creativeLoading?'#444':'#000'}}>
                {creativeLoading?'Analyzing…':creativeImages.length>0?`Analyze ${creativeImages.length} creative${creativeImages.length>1?'s':''} ↗`:'Analyze Creatives'}
              </button>
            </div>
            <Card style={{borderColor:'rgba(200,241,53,0.15)'}}>
              <CardHead color={C.accent}>Upload ad creatives for visual scoring (optional)</CardHead>
              <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:12}}>Drop screenshots of your actual ads. Claude scores hook strength, copy clarity, format fit, and CTA — then combines with campaign data for a full creative audit. Without images, analysis is based on frequency and CPM signals only.</div>
              <ImageUploadZone onImages={setCreativeImages} images={creativeImages}/>
            </Card>
            {!data.meta&&creativeImages.length===0&&<div style={{textAlign:'center',padding:'32px 20px',color:'#555560'}}><div style={{fontSize:28,marginBottom:10,opacity:0.4}}>🎨</div><div style={{fontSize:14,fontWeight:700,color:'#e8e8ee',marginBottom:6}}>Upload creatives or load Meta data</div></div>}
            {creativeLoading&&<div style={{display:'flex',gap:10,alignItems:'center',...mono,fontSize:12,color:C.accent,padding:'16px 0'}}><Spinner color={C.accent}/>{creativeImages.length>0?'Examining visuals and performance data…':'Analyzing performance metrics and fatigue signals…'}</div>}
            {creativeData&&(
              <div>
                {creativeData.visualAnalysis?.length>0&&(
                  <Card>
                    <CardHead color={C.accent}>Visual creative scores</CardHead>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                      {creativeData.visualAnalysis.map((v,i)=>{
                        const sc=v.overallScore>=7?C.teal:v.overallScore>=5?C.amber:C.coral
                        return(
                          <div key={i} style={{background:'#161619',border:`1px solid ${sc}30`,borderRadius:10,padding:14}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                              <div style={{...mono,fontSize:10,color:'#555560'}}>Creative {i+1}</div>
                              <div style={{fontSize:20,fontWeight:900,color:sc}}>{v.overallScore}<span style={{fontSize:12,color:'#444'}}>/10</span></div>
                            </div>
                            {[['Hook',v.hookStrength,v.hookNote],['Copy',null,v.copyNote],['Format',v.formatFit,null],['CTA',v.ctaClarity,null]].map(([label,rating,note])=>(
                              <div key={label} style={{display:'flex',gap:8,marginBottom:5,alignItems:'flex-start'}}>
                                <span style={{...mono,fontSize:9,color:'#555560',width:44,flexShrink:0,paddingTop:2}}>{label}</span>
                                {rating&&<Badge type={rating==='Strong'||rating==='Good'?'g':rating==='OK'?'w':'r'}>{rating}</Badge>}
                                {note&&<span style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.5,flex:1}}>{note}</span>}
                              </div>
                            ))}
                            <div style={{marginTop:10,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:10}}>
                              <div style={{...mono,fontSize:10,color:C.coral,marginBottom:4}}>↓ {v.topIssue}</div>
                              <div style={{...mono,fontSize:10,color:C.teal,marginBottom:6}}>↑ {v.topStrength}</div>
                              <div style={{...mono,fontSize:10,color:C.accent}}>→ {v.recommendation}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}
                <Card><CardHead>Fatigue assessment</CardHead>{(creativeData.fatigueAssessment||[]).map((f,i)=>{const c=f.status==='OK'?C.teal:f.status==='Watch'?C.amber:C.coral;const bt=f.status==='OK'?'g':f.status==='Watch'?'w':'r';return(<div key={i} style={{display:'flex',gap:12,padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}><div style={{width:3,borderRadius:2,background:c,flexShrink:0,minHeight:36,alignSelf:'stretch'}}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,marginBottom:4,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>{f.campaign.length>40?f.campaign.slice(0,37)+'…':f.campaign}<Badge type={bt}>{f.status}</Badge><span style={{...mono,fontSize:10,color:'#555560'}}>freq {f.frequency}</span></div><div style={{...mono,fontSize:10,color:C.accent}}>→ {f.action}</div></div></div>)})}</Card>
                <Card><CardHead>Hook angles to test</CardHead>{(creativeData.hookAngles||[]).map((h,i)=>(
                  <div key={i} style={{display:'flex',gap:12,padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}><div style={{width:3,borderRadius:2,background:C.accent,flexShrink:0,minHeight:36,alignSelf:'stretch'}}/><div><div style={{fontSize:12,fontWeight:700,marginBottom:6}}>{h.angle}</div><div style={{...mono,fontSize:12,color:C.accent,background:'#161619',padding:'6px 10px',borderRadius:5,marginBottom:6}}>"{h.hook}"</div><div style={{...mono,fontSize:11,color:'#9898a8',lineHeight:1.7}}>{h.why}</div></div></div>
                ))}</Card>
                <Card>
                  <CardHead>Creative briefs — produce these next</CardHead>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                    {(creativeData.creativeBriefs||[]).map((b,i)=>(
                      <div key={i} style={{background:'#161619',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,padding:14}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                          <div style={{...mono,fontSize:9,color:'#555560',textTransform:'uppercase',letterSpacing:'0.1em'}}>{b.format} · {b.audience}</div>
                          <Badge type={b.priority==='HIGH'?'r':'w'}>{b.priority}</Badge>
                        </div>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>{b.title}</div>
                        <div style={{...mono,fontSize:10,color:C.accent,marginBottom:6}}>Hook: "{b.hook}"</div>
                        <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.6,marginBottom:8}}>{b.visual||''}</div>
                        <div style={{...mono,fontSize:10,color:C.amber}}>CTA: {b.cta}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
