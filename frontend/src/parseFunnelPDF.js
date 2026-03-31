// parseFunnelPDF.js
// Loads pdfjs from CDN at runtime to avoid Vite/Rolldown bundling issues

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'

let pdfjsLib = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const mod = await import(/* @vite-ignore */ PDFJS_CDN)
  pdfjsLib = mod
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN
  return pdfjsLib
}

const toNum = v => {
  if (!v) return null
  const s = String(v)
  const c = s.replace(/[$,]/g, '').trim()
  if (s.endsWith('K')) return parseFloat(c) * 1000
  return parseFloat(c) || null
}

const fmtDec = (v, d = 2) => v != null ? v.toFixed(d) : null

async function extractText(file) {
  const pdfjs = await getPdfjs()
  const buf = await file.arrayBuffer()
  const data = new Uint8Array(buf)
  const pdf = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text
}

export async function parseFunnelPDF(file) {
  const text = await extractText(file)
  const g = (pattern) => text.match(pattern)

  const dr = g(/(\d+\s*-\s*\d+\s+\w+\s+\d{4})/)
  const dateRange = dr ? dr[1].trim() : 'Last 7 days'

  const nmpds      = g(/NMPDS - OVERALL\s+\$([\d.]+)/)?.[1]
  const roas       = g(/ROAS - OVERALL\s+([\d.]+)/)?.[1]
  const mediaSpend = g(/Media Spend - OVERA\s+\$([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '')
  const totalSales = fmtDec(toNum(g(/Total Sales - OVERAL\s+\$([\d,.]+K?)/)?.[1]), 0)
  const attSales   = fmtDec(toNum(g(/Attributed Sales - OV\s+\$([\d,.]+K?)/)?.[1]), 0)
  const impressions= fmtDec(toNum(g(/Impressions - OVERA\s+([\d,.]+K?)/)?.[1]), 0)
  const sessions   = fmtDec(toNum(g(/Sessions - OVERALL\s+([\d,.]+K?)/)?.[1]), 0)
  const clicks     = fmtDec(toNum(g(/Clicks - OVERALL\s+([\d,.]+K?)/)?.[1]), 0)

  const allNmpds   = [...text.matchAll(/NMPDS - META\s+\$([\d.]+)/g)]
  const nmdsMeta   = allNmpds[0]?.[1] ?? null
  const nmpdsGoogle= allNmpds[1]?.[1] ?? null
  const roasMeta   = g(/ROAS - META\s+([\d.]+)/)?.[1]
  const roasGoogle = g(/ROAS - Google\s+([\d.]+)/)?.[1]
  const attMeta    = fmtDec(toNum(g(/Attributed Sales - ME\s+\$([\d,.]+K?)/)?.[1]), 0)
  const spendMeta  = g(/Media Spend - META\s+\$([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, '')
  const attGoogle  = fmtDec(toNum(g(/Attributed Sales - Go\s+\$([\d,.]+K?)/)?.[1]), 0)

  const gmatch     = g(/Google PMax\s+([\d,]+)\s+([\d,]+)\s+\$([\d,]+\.?\d*)\s+(\d+)\s+\$([\d,]+\.?\d*)/)
  const mmatch     = g(/Meta Paid\s+([\d,]+)\s+([\d,]+)\s+\$([\d,]+\.?\d*)\s+(\d+)\s+\$([\d,]+\.?\d*)/)
  const orgMatch   = g(/Organic Search\s+-\s+-\s+-\s+(\d+)\s+\$([\d,]+\.?\d*)/)
  const emailMatch = g(/Email\s+-\s+-\s+-\s+(\d+)\s+\$([\d,]+\.?\d*)/)
  const ytMatch    = g(/YouTube\s+-\s+-\s+-\s+(\d+)\s+\$([\d,]+\.?\d*)/)
  const dirMatch   = g(/Direct\s+-\s+-\s+-\s+(\d+)\s+\$([\d,]+\.?\d*)/)

  const channels = {
    googlePMax:    gmatch   ? { impressions:toNum(gmatch[1]),   clicks:toNum(gmatch[2]),   cost:toNum(gmatch[3]),   transactions:parseInt(gmatch[4]),   revenue:toNum(gmatch[5])   } : null,
    metaPaid:      mmatch   ? { impressions:toNum(mmatch[1]),   clicks:toNum(mmatch[2]),   cost:toNum(mmatch[3]),   transactions:parseInt(mmatch[4]),   revenue:toNum(mmatch[5])   } : null,
    organicSearch: orgMatch ? { transactions:parseInt(orgMatch[1]),   revenue:toNum(orgMatch[2])   } : null,
    email:         emailMatch?{ transactions:parseInt(emailMatch[1]), revenue:toNum(emailMatch[2]) } : null,
    youtube:       ytMatch  ? { transactions:parseInt(ytMatch[1]),    revenue:toNum(ytMatch[2])    } : null,
    direct:        dirMatch ? { transactions:parseInt(dirMatch[1]),   revenue:toNum(dirMatch[2])   } : null,
  }

  return {
    dateRange,
    overall: { nmpds, roas, mediaSpend, totalSales, attributedSales: attSales, impressions, sessions, clicks },
    meta:    { nmpds: nmdsMeta,   roas: roasMeta,   attributedSales: attMeta,   mediaSpend: spendMeta },
    google:  { nmpds: nmpdsGoogle, roas: roasGoogle, attributedSales: attGoogle },
    channels,
  }
}
