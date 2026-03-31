import { useState, useRef, useCallback } from 'react'
import { parseCSV, detectChannel, normalizeMeta, normalizeGoogle, buildDataSummary, getSignal, getFreqBadge } from './utils.js'
import { API_URL, MEDIA_BUYER_SYSTEM, CREATIVE_SYSTEM, CHAT_SYSTEM } from './constants.js'

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
      <div style={{fontSize:22,fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,marginBottom:5,color:color||'#e8e8ee'}}>{value}</div>
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

function UploadZone({ channel, onFile, label, hint, compact }) {
  const [over, setOver] = useState(false)
  return (
    <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);const f=e.dataTransfer.files[0];if(f)onFile(f,channel)}}
      style={{border:`2px dashed ${over?C.accent:'rgba(255,255,255,0.12)'}`,borderRadius:10,padding:compact?'12px 16px':'28px 24px',textAlign:'center',cursor:'pointer',position:'relative',background:over?'rgba(200,241,53,0.03)':'#0f0f12',marginBottom:10,transition:'all 0.2s'}}>
      <input type="file" accept=".csv" onChange={e=>{if(e.target.files[0])onFile(e.target.files[0],channel)}} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
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
    if (!valid.length) { alert('Please upload image files (JPG, PNG, etc.)'); return }
    onImages(prev => [...prev, ...valid].slice(0, 6))
  }
  return (
    <div>
      <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);handleFiles(e.dataTransfer.files)}}
        style={{border:`2px dashed ${over?C.accent:'rgba(255,255,255,0.12)'}`,borderRadius:10,padding:'20px 24px',textAlign:'center',cursor:'pointer',position:'relative',background:over?'rgba(200,241,53,0.03)':'#0f0f12',marginBottom:12,transition:'all 0.2s'}}>
        <input type="file" accept="image/*" multiple onChange={e=>handleFiles(e.target.files)} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
        <div style={{fontSize:22,marginBottom:6}}>🖼️</div>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Drop ad creatives here</div>
        <div style={{...mono,fontSize:11,color:'#666672',lineHeight:1.7}}>Screenshots of your ads · Up to 6 images · JPG, PNG<br/>Tip: screenshot the first frame of video ads</div>
      </div>
      {images.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {images.map((img, i) => (
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

export default function App() {
  const [tab,setTab]=useState('dashboard')
  const [data,setData]=useState({meta:null,google:null})
  const [briefing,setBriefing]=useState(null)
  const [creativeData,setCreativeData]=useState(null)
  const [creativeImages,setCreativeImages]=useState([])
  const [loading,setLoading]=useState(false)
  const [creativeLoading,setCreativeLoading]=useState(false)
  const [loadingMsg,setLoadingMsg]=useState('')
  const [chatHistory,setChatHistory]=useState([])
  const [chatInput,setChatInput]=useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const [error,setError]=useState('')
  const [showClear,setShowClear]=useState(false)
  const [nmpds,setNmpds]=useState('2.46')
  const [roasOverall,setRoasOverall]=useState('6.92')
  const [mediaSpend,setMediaSpend]=useState('13800')
  const [totalSales,setTotalSales]=useState('318000')
  const [attributedSales,setAttributedSales]=useState('95500')
  const [sessions,setSessions]=useState('142000')
  const [fClicks,setFClicks]=useState('52200')
  const [impressions,setImpressions]=useState('1710000')
  const [dateRange,setDateRange]=useState('Last 30 days')
  const chatRef=useRef(null)
  const msgInterval=useRef(null)
  const hasData=Object.values(data).some(v=>v)
  const MSGS=['Checking frequency thresholds…','Applying three-strikes kill rule…','Scoring campaign structure…','Evaluating creative fatigue…','Building scaling recommendations…','Generating new ad set proposals…','Calculating NMPDS action zones…']
  const inputStyle={background:'#1a1a1f',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'5px 8px',color:'#e8e8ee',...mono,fontSize:12,outline:'none'}

  const processFile=useCallback((file,channel)=>{
    if(!file||!file.name.endsWith('.csv')){alert('Please upload a .csv file');return}
    const reader=new FileReader()
    reader.onload=e=>{
      const raw=parseCSV(e.target.result)
      if(!raw.length){alert('No data found in CSV');return}
      const hdrs=Object.keys(raw[0])
      const ch=channel==='auto'?detectChannel(hdrs):channel
      const rows=ch==='meta'?normalizeMeta(raw):normalizeGoogle(raw)
      if(!rows.length){
        alert(`No campaigns with spend found.\n\nColumns detected: ${hdrs.slice(0,6).join(', ')}\n\nFor Google Ads: make sure the export includes a "Cost" column with values greater than 0. Remove any summary rows at the top of the file.`)
        return
      }
      setData(prev=>({...prev,[ch]:{rows,file:file.name,loaded:new Date().toLocaleTimeString()}}))
      setTab('dashboard')
    }
    reader.readAsText(file)
  },[])

  const clearData=(channel)=>{
    if(channel==='all'){setData({meta:null,google:null});setBriefing(null);setCreativeData(null);setCreativeImages([]);setChatHistory([]);setError('')}
    else setData(prev=>({...prev,[channel]:null}))
  }

  const buildFunnelSummary=()=>`FUNNEL.IO (${dateRange}, 7-day lookback attribution, all channels blended):
- NMPDS: $${nmpds} — for every $1 spent, $${nmpds} net returned
- Blended ROAS: ${roasOverall}x
- Media Spend: $${parseFloat(mediaSpend||0).toLocaleString()}
- Total Sales: $${parseFloat(totalSales||0).toLocaleString()}
- Attributed Sales: $${parseFloat(attributedSales||0).toLocaleString()}
- Sessions: ${parseFloat(sessions||0).toLocaleString()}
- Clicks: ${parseFloat(fClicks||0).toLocaleString()}
- Impressions: ${parseFloat(impressions||0).toLocaleString()}
- Break-even ROAS: 5.0x (confirmed by Funnel.io cost model including COGS + agency fees)
- Scale threshold: ROAS > 6.5x AND NMPDS > $2.00`

  const callAPI=async(system,messages,maxTokens=2200)=>{
    const res=await fetch(`${API_URL}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system,messages,max_tokens:maxTokens})})
    if(!res.ok){const err=await res.json().catch(()=>({error:'Server error'}));throw new Error(err.error||`Error ${res.status}`)}
    const result=await res.json()
    return result.content?.[0]?.text||''
  }

  const runBriefing=async()=>{
    if(!hasData)return
    setLoading(true);setError('');setBriefing(null)
    let mi=0;setLoadingMsg(MSGS[0])
    msgInterval.current=setInterval(()=>{mi++;setLoadingMsg(MSGS[mi%MSGS.length])},2200)
    try{
      const summary=buildDataSummary(data,nmpds,roasOverall)+'\n\n'+buildFunnelSummary()
      const txt=await callAPI(MEDIA_BUYER_SYSTEM,[{role:'user',content:summary+'\n\nGenerate a full media buyer briefing.'}],2200)
      setBriefing(JSON.parse(txt.replace(/```json\n?|```\n?/g,'').trim()))
    }catch(err){setError('Analysis failed: '+err.message)}
    clearInterval(msgInterval.current);setLoading(false)
  }

  const runCreative=async()=>{
    if(!data.meta&&creativeImages.length===0)return
    setCreativeLoading(true);setCreativeData(null)
    const metaSum=data.meta?data.meta.rows.map(r=>`- "${r.name}": ROAS ${r.roas.toFixed(2)}x, Freq ${r.frequency.toFixed(2)}, CPM $${r.cpm.toFixed(2)}, Spend $${r.spend.toFixed(0)}, Purchases ${r.purchases}`).join('\n'):'No Meta campaign data'
    try{
      let messages
      if(creativeImages.length>0){
        const imageContents=await Promise.all(creativeImages.map(async img=>({type:'image',source:{type:'base64',media_type:img.type,data:await imageToBase64(img)}})))
        messages=[{role:'user',content:[...imageContents,{type:'text',text:`Analyze these ${creativeImages.length} ad creative(s) for KM Tools (woodworking tools, target: male 30-55 DIY/semi-pro woodworker).\n\nFor each creative evaluate: hook strength (is problem/product clear in first frame?), copy clarity (text overlay readable on mobile?), format fit (native to placement?), authenticity (UGC vs polished?), CTA visibility, overall score 1-10.\n\nAlso use this campaign performance data:\n${metaSum}\n\n${buildFunnelSummary()}\n\nReturn ONLY valid JSON:\n{"visualAnalysis":[{"creativeIndex":number,"hookStrength":"Weak|OK|Strong","hookNote":"first frame assessment","copyNote":"text overlay assessment","formatFit":"Poor|OK|Good","overallScore":number,"topIssue":"biggest problem","topStrength":"biggest strength","recommendation":"specific action"}],"fatigueAssessment":[{"campaign":"name","frequency":number,"status":"OK|Watch|Warning|Critical","action":"specific action"}],"hookAngles":[{"angle":"name","hook":"exact opening line","why":"why this works for woodworking buyers"}],"creativeBriefs":[{"title":"name","format":"Static Image|Short Video|UGC|Carousel|Reels","hook":"first 3 seconds","visual":"what to show","cta":"call to action","audience":"Cold|Warm|Retargeting","priority":"HIGH|MEDIUM"}]}`}]}]
      }else{
        messages=[{role:'user',content:`Meta campaign data:\n${metaSum}\n\n${buildFunnelSummary()}\n\nAnalyze creative fatigue and generate briefs for woodworking tools audience.`}]
      }
      const txt=await callAPI(CREATIVE_SYSTEM,messages,1800)
      setCreativeData(JSON.parse(txt.replace(/```json\n?|```\n?/g,'').trim()))
    }catch(err){setError('Creative analysis failed: '+err.message)}
    setCreativeLoading(false)
  }

  const sendChat=async()=>{
    if(!chatInput.trim()||chatLoading)return
    const msg=chatInput.trim();setChatInput('')
    setChatHistory(prev=>[...prev,{role:'user',content:msg}])
    setChatLoading(true)
    try{
      const context=`DATA:\n${buildDataSummary(data,nmpds,roasOverall)}\n\n${buildFunnelSummary()}\n\nBRIEFING:\n${briefing?.execSummary||'None yet'}\n\nQUESTION: ${msg}`
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
  const tabs=[{id:'dashboard',label:'Dashboard'},{id:'analysis',label:'🧠 AI Media Buyer'},{id:'data',label:'Data Sources'},{id:'creative',label:'Creative'}]

  return (
    <div style={{background:'#080809',minHeight:'100vh',color:'#e8e8ee',fontFamily:"'Epilogue', sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e1e22;border-radius:2px}`}</style>

      <div style={{height:50,borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',padding:'0 24px',gap:12,background:'rgba(8,8,9,0.98)',position:'sticky',top:0,zIndex:100}}>
        <div style={{width:26,height:26,background:C.accent,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#000'}}>KM</div>
        <span style={{fontSize:12,fontWeight:800,letterSpacing:'0.08em',textTransform:'uppercase'}}>AI Media Buyer</span>
        <span style={{...mono,fontSize:9,background:'#1a1a1f',border:'1px solid rgba(255,255,255,0.1)',color:'#666',padding:'2px 7px',borderRadius:20}}>2026</span>
        <div style={{marginLeft:'auto',display:'flex',gap:12,alignItems:'center'}}>
          {hasData&&<span style={{...mono,fontSize:10,color:C.teal,display:'flex',alignItems:'center',gap:5}}><span style={{width:5,height:5,borderRadius:'50%',background:C.teal}}/>Data loaded</span>}
          {hasData&&(
            <div style={{position:'relative'}}>
              <button onClick={()=>setShowClear(true)} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:5,padding:'3px 10px',cursor:'pointer'}}>Clear all</button>
              {showClear&&(
                <div style={{position:'absolute',right:0,top:32,background:'#1a1a1f',border:'1px solid rgba(255,77,77,0.4)',borderRadius:8,padding:'12px 16px',whiteSpace:'nowrap',zIndex:200}}>
                  <div style={{...mono,fontSize:11,color:'#e8e8ee',marginBottom:10}}>Clear all imported data?</div>
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

      <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0f0f12',padding:'0 24px',overflowX:'auto'}}>
        {tabs.map(t=><div key={t.id} onClick={()=>setTab(t.id)} style={{padding:'11px 16px',fontSize:12,fontWeight:600,color:tab===t.id?'#e8e8ee':'#555560',cursor:'pointer',borderBottom:tab===t.id?`2px solid ${C.accent}`:'2px solid transparent',whiteSpace:'nowrap',transition:'all 0.15s'}}>{t.label}</div>)}
      </div>

      <div style={{padding:'20px 24px',maxWidth:1200}}>
        {error&&<div style={{background:'rgba(255,107,91,0.1)',border:'1px solid rgba(255,107,91,0.3)',borderRadius:8,padding:'12px 16px',marginBottom:14,...mono,fontSize:11,color:C.coral,display:'flex',justifyContent:'space-between',alignItems:'center'}}>{error}<button onClick={()=>setError('')} style={{background:'none',border:'none',color:C.coral,cursor:'pointer',fontSize:18,lineHeight:1}}>×</button></div>}

        {/* DASHBOARD */}
        {tab==='dashboard'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div><div style={{fontSize:20,fontWeight:800}}>Dashboard</div><div style={{...mono,fontSize:10,color:'#555560',marginTop:3}}>Funnel.io + CSV · {dateRange}</div></div>
              <button onClick={()=>setTab('data')} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'8px 16px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000'}}>+ Import Data</button>
            </div>

            <Card style={{borderColor:'rgba(200,241,53,0.2)',background:'#0d0d10'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
                <div style={{...mono,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:C.accent}}>Funnel.io actuals — update from your dashboard</div>
                <select value={dateRange} onChange={e=>setDateRange(e.target.value)} style={{...inputStyle,fontSize:11,padding:'4px 8px'}}>
                  <option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option><option>This month</option><option>Last month</option>
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                <MetricCard label="NMPDS" value={`$${nmpds}`} sub={parseFloat(nmpds)>=2?'↑ Scale zone':parseFloat(nmpds)>=1?'~ Optimize':'↓ Watch'} color={parseFloat(nmpds)>=2?C.teal:parseFloat(nmpds)>=1?C.amber:C.coral}/>
                <MetricCard label="Blended ROAS" value={`${roasOverall}×`} sub={parseFloat(roasOverall)>=6.5?'↑ Scale zone':parseFloat(roasOverall)>=5?'~ Profitable':'↓ Below break-even'} color={parseFloat(roasOverall)>=6.5?C.teal:parseFloat(roasOverall)>=5?C.amber:C.coral}/>
                <MetricCard label="Media spend" value={'$'+parseFloat(mediaSpend||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub={dateRange}/>
                <MetricCard label="Total sales" value={'$'+parseFloat(totalSales||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub="7-day lookback"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
                <MetricCard label="Attributed sales" value={'$'+parseFloat(attributedSales||0).toLocaleString('en-US',{maximumFractionDigits:0})} sub="Ad-attributed"/>
                <MetricCard label="Impressions" value={(parseFloat(impressions||0)/1000000).toFixed(2)+'M'} sub="All channels"/>
                <MetricCard label="Sessions" value={(parseFloat(sessions||0)/1000).toFixed(1)+'K'} sub="Site visits"/>
                <MetricCard label="Clicks" value={(parseFloat(fClicks||0)/1000).toFixed(1)+'K'} sub="Ad clicks"/>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
                <span style={{...mono,fontSize:10,color:'#555'}}>Update numbers:</span>
                {[['NMPDS $',nmpds,setNmpds,68],['ROAS',roasOverall,setRoasOverall,58],['Spend $',mediaSpend,setMediaSpend,90],['Total sales $',totalSales,setTotalSales,100],['Attributed $',attributedSales,setAttributedSales,100],['Impressions',impressions,setImpressions,100],['Sessions',sessions,setSessions,90],['Clicks',fClicks,setFClicks,90]].map(([label,val,setter,w])=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{...mono,fontSize:10,color:'#555'}}>{label}</span>
                    <input value={val} onChange={e=>setter(e.target.value)} style={{...inputStyle,width:w,fontSize:11,padding:'4px 6px'}}/>
                  </div>
                ))}
              </div>
            </Card>

            {!hasData?(
              <div style={{textAlign:'center',padding:'40px 20px'}}>
                <div style={{fontSize:28,marginBottom:10,opacity:0.4}}>⚡</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>Import your ad platform CSVs</div>
                <div style={{...mono,fontSize:11,color:'#666',lineHeight:1.8,marginBottom:16}}>Go to Data Sources to import Meta and Google Ads exports</div>
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
                  <div><div style={{fontSize:15,fontWeight:800,marginBottom:4}}>Run your AI Media Buyer briefing</div><div style={{...mono,fontSize:11,color:'#666'}}>190 checks · 2026 frameworks · Funnel.io + CSV data combined</div></div>
                  <button onClick={()=>{setTab('analysis');setTimeout(runBriefing,100)}} style={{fontFamily:'inherit',fontSize:13,fontWeight:700,padding:'10px 24px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000'}}>Generate Briefing ↗</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI ANALYSIS */}
        {tab==='analysis'&&(
          <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>AI Media Buyer</div>
            <div style={{...mono,fontSize:10,color:'#555560',marginBottom:20}}>2026 frameworks · 190 checks · NMPDS-anchored · 5× break-even</div>
            <button disabled={!hasData||loading} onClick={runBriefing} style={{width:'100%',padding:16,background:!hasData||loading?'#1a1a1f':C.accent,color:!hasData||loading?'#444':'#000',border:'none',borderRadius:10,fontFamily:'inherit',fontSize:14,fontWeight:800,cursor:!hasData||loading?'not-allowed':'pointer',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all 0.15s'}}>
              {loading?<><Spinner color={C.accent}/><span style={{color:C.accent}}>{loadingMsg}</span></>:briefing?'🔄  Re-run Briefing':hasData?'🧠  Generate Briefing':'Import data first on the Data Sources tab'}
            </button>
            {!briefing&&!loading&&<div style={{textAlign:'center',padding:'40px 20px',color:'#555560'}}><div style={{fontSize:32,marginBottom:12,opacity:0.4}}>🧠</div><div style={{fontSize:14,fontWeight:700,color:'#e8e8ee',marginBottom:8}}>Senior media buyer on standby</div><div style={{...mono,fontSize:11,lineHeight:1.8}}>Import CSV on Data Sources tab, update Funnel.io numbers, then hit Generate Briefing.</div></div>}
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
                  <Card><CardHead color={C.teal}>Scale these ↑</CardHead>{(briefing.scale||[]).length?briefing.scale.map((i,idx)=><ListItem key={idx} item={i} color={C.teal}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None flagged</div>}</Card>
                  <Card><CardHead color={C.coral}>Pause or fix ✕</CardHead>{(briefing.pause||[]).length?briefing.pause.map((i,idx)=><ListItem key={idx} item={i} color={C.coral}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None flagged</div>}</Card>
                  <Card><CardHead color={C.amber}>New ad sets to test</CardHead>{(briefing.newAdSets||[]).length?briefing.newAdSets.map((i,idx)=><ListItem key={idx} item={i} color={C.amber}/>):<div style={{...mono,fontSize:10,color:'#444'}}>None suggested</div>}</Card>
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
                    {chatHistory.length===0&&<div style={{...mono,fontSize:11,color:'#444',padding:'8px 0'}}>Ask anything — scaling, creative strategy, budget decisions, campaign structure…</div>}
                    {chatHistory.map((m,i)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{...mono,fontSize:9,color:m.role==='user'?'#555560':C.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>{m.role==='user'?'You':'Media Buyer'}</div>
                        <div style={{...mono,fontSize:11,color:m.role==='user'?'#e8e8ee':'#9898a8',lineHeight:1.7,borderLeft:m.role==='assistant'?`2px solid ${C.accent}`:'none',paddingLeft:m.role==='assistant'?12:0,whiteSpace:'pre-wrap'}}>{m.content}</div>
                      </div>
                    ))}
                    {chatLoading&&<div style={{display:'flex',gap:8,alignItems:'center',...mono,fontSize:11,color:C.accent}}><Spinner color={C.accent}/>Thinking…</div>}
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                    <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}}} placeholder="e.g. Should I scale Product Sets ASC? What hooks work for router tables? How should I structure campaigns by margin tier?" style={{flex:1,background:'#161619',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'10px 14px',color:'#e8e8ee',...mono,fontSize:12,resize:'none',minHeight:42,maxHeight:100,outline:'none'}}/>
                    <button onClick={sendChat} disabled={chatLoading} style={{fontFamily:'inherit',fontSize:12,fontWeight:700,padding:'10px 16px',borderRadius:8,border:'none',cursor:'pointer',background:C.accent,color:'#000',flexShrink:0}}>Ask ↗</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* DATA SOURCES */}
        {tab==='data'&&(
          <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Data Sources</div>
            <div style={{...mono,fontSize:10,color:'#555560',marginBottom:20}}>Import · Replace · Remove CSV exports from each ad channel</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              {[['meta','Meta Ads',C.meta,'Ads Manager → Campaigns → Export CSV\nInclude: Amount spent, Purchases, ROAS, CPM, Frequency, Reach'],['google','Google Ads',C.google,'Google Ads → Campaigns tab → Download → CSV\nRequired columns: Cost, Conversions, Conv. value, Clicks, Impr.']].map(([ch,label,color,hint])=>(
                <Card key={ch}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,...mono,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:'#555560'}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block'}}/>{label}
                    </div>
                    {data[ch]&&<button onClick={()=>clearData(ch)} style={{...mono,fontSize:10,background:'transparent',border:'1px solid rgba(255,77,77,0.3)',color:C.coral,borderRadius:4,padding:'2px 8px',cursor:'pointer'}}>Remove</button>}
                  </div>
                  {data[ch]?(
                    <div>
                      <div style={{...mono,fontSize:10,color:C.teal,marginBottom:6}}>✓ {data[ch].file}</div>
                      <div style={{...mono,fontSize:10,color:'#555560',marginBottom:12}}>{data[ch].rows.length} campaigns · Loaded {data[ch].loaded}</div>
                      <UploadZone channel={ch} onFile={processFile} label="Replace with new CSV" hint="" compact/>
                    </div>
                  ):(
                    <div>
                      {ch==='google'&&<div style={{...mono,fontSize:10,color:C.amber,marginBottom:10,lineHeight:1.7,background:'rgba(255,178,36,0.08)',padding:'8px 10px',borderRadius:6}}>If you get "no campaigns found": open the CSV and confirm the column is named exactly "Cost" (not "Spend"). Also delete any summary rows at the top of the file before importing.</div>}
                      <div style={{...mono,fontSize:10,color:'#555560',marginBottom:10,lineHeight:1.8,whiteSpace:'pre-line'}}>{hint}</div>
                      <UploadZone channel={ch} onFile={processFile} label={`Drop ${label} CSV here`} hint="Campaign-level export"/>
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <Card>
              <CardHead>Recommended cadence</CardHead>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {[['Weekly',C.teal,['Meta CSV — last 7 days','Update Funnel.io numbers','Run AI briefing','Action top 2-3 items'],'Your core rhythm. Frequency changes fast — weekly is the minimum for Meta.'],['Monthly',C.amber,['Google Ads CSV — last 30 days','Meta CSV for trend view','Both channels in one briefing','Structural decisions'],'Google Smart Bidding needs 2-4 weeks to stabilize. Monthly Google reads match the signal cycle.'],['Quarterly',C.violet,['90-day CSV from both channels','Margin tier analysis','Campaign structure review','Channel reallocation decisions'],'Strategic layer. Which categories to scale or cut, how to restructure by product margin.']].map(([period,color,items,note])=>(
                  <div key={period} style={{background:'#161619',borderRadius:8,padding:14}}>
                    <div style={{fontSize:13,fontWeight:700,color,marginBottom:10}}>{period}</div>
                    {items.map((item,i)=><div key={i} style={{...mono,fontSize:10,color:'#9898a8',marginBottom:6,display:'flex',gap:6}}><span style={{color}}>·</span>{item}</div>)}
                    <div style={{...mono,fontSize:10,color:'#444',marginTop:10,lineHeight:1.6,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:10}}>{note}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* CREATIVE */}
        {tab==='creative'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div><div style={{fontSize:20,fontWeight:800}}>Creative Analysis</div><div style={{...mono,fontSize:10,color:'#555560',marginTop:3}}>Visual scoring · Fatigue signals · Hook angles · Production briefs</div></div>
              <button disabled={(!data.meta&&creativeImages.length===0)||creativeLoading} onClick={runCreative} style={{fontFamily:'inherit',fontSize:13,fontWeight:700,padding:'9px 18px',borderRadius:8,border:'none',cursor:(!data.meta&&creativeImages.length===0)||creativeLoading?'not-allowed':'pointer',background:(!data.meta&&creativeImages.length===0)||creativeLoading?'#1a1a1f':C.accent,color:(!data.meta&&creativeImages.length===0)||creativeLoading?'#444':'#000'}}>
                {creativeLoading?'Analyzing…':creativeImages.length>0?`Analyze ${creativeImages.length} creative${creativeImages.length>1?'s':''} ↗`:'Analyze Creatives'}
              </button>
            </div>
            <Card style={{borderColor:'rgba(200,241,53,0.15)'}}>
              <CardHead color={C.accent}>Upload ad creatives for visual analysis (optional)</CardHead>
              <div style={{...mono,fontSize:10,color:'#9898a8',lineHeight:1.7,marginBottom:12}}>Drop screenshots of your actual ad images or video first-frames. Claude will score hook strength, copy clarity, format fit, authenticity, and CTA — combined with your campaign performance data for a full creative audit. Without images, analysis is based on frequency and CPM signals only.</div>
              <ImageUploadZone onImages={setCreativeImages} images={creativeImages}/>
            </Card>
            {!data.meta&&creativeImages.length===0&&<div style={{textAlign:'center',padding:'32px 20px',color:'#555560'}}><div style={{fontSize:28,marginBottom:10,opacity:0.4}}>🎨</div><div style={{fontSize:14,fontWeight:700,color:'#e8e8ee',marginBottom:6}}>Upload creatives or load Meta data</div><div style={{...mono,fontSize:11,lineHeight:1.8}}>Drop ad screenshots above, or import Meta CSV from Data Sources</div></div>}
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
