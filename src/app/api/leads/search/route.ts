import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Domains where victims/complainants actually post
const COMPLAINT_DOMAINS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'tiktok.com', 'reddit.com', 'lowyat.net', 'forum.lowyat.net',
  'cari.com.my', 'malaysianbar.org.my', 'sinchew.com.my',
  'says.com', 'freemalaysiatoday.com', 'malaymail.com',
  'mstar.com.my', 'hmetro.com.my', 'bharian.com.my',
]

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

interface TavilyResponse {
  results: TavilyResult[]
}

async function tavilySearch(query: string, domains?: string[]): Promise<TavilyResult[]> {
  const body: Record<string, unknown> = {
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: 'advanced',
    max_results: 10,
    include_answer: false,
  }
  if (domains?.length) body.include_domains = domains

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []
  const data = await res.json() as TavilyResponse
  return data.results ?? []
}

function detectPlatform(url: string): string {
  if (!url) return 'Web'
  if (url.includes('facebook.com')) return 'Facebook'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X / Twitter'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('tiktok.com')) return 'TikTok'
  if (url.includes('youtube.com')) return 'YouTube'
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('reddit.com')) return 'Reddit'
  if (url.includes('telegram.me') || url.includes('t.me')) return 'Telegram'
  if (url.includes('lowyat.net')) return 'Lowyat Forum'
  if (url.includes('cari.com.my')) return 'Cari Forum'
  try { return new URL(url).hostname.replace('www.', '') } catch { return 'Web' }
}

interface SearchCombo {
  entity: string
  keyword: string
  query: string
  domains?: string[]
}

// Every query MUST include an entity name/alias — entity is always quoted
// Allegation framing is baked in so Tavily scores complaint posts higher
function buildAllegationQueries(entityName: string, aliases: string[], keywords: string[]): SearchCombo[] {
  const combos: SearchCombo[] = []

  // Names to search — primary + non-generic aliases
  const genericNames = new Set(['coach', 'cf', 'coach fadzil'])
  const searchNames = [entityName, ...aliases].filter(n => !genericNames.has(n.toLowerCase()))
  if (!searchNames.length) searchNames.push(entityName)

  // Group keywords into allegation-type and context-type
  const allegationKws = keywords.filter(k =>
    /tipu|penipu|scam|penipuan|fraud|ponzi|mlm|menipu|bohong|complaint|mangsa|victim|rugi|hilang wang|tak bayar|duit|curi/i.test(k)
  )
  const contextKws = keywords.filter(k => !allegationKws.includes(k))

  for (const name of searchNames.slice(0, 4)) {
    // Query 1: entity + allegation keyword → social media
    for (const kw of allegationKws.slice(0, 3)) {
      combos.push({
        entity: entityName,
        keyword: kw,
        query: `"${name}" ${kw}`,
        domains: ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'],
      })
    }

    // Query 2: entity + allegation + Malay complaint framing → forums and news
    if (allegationKws.length > 0) {
      combos.push({
        entity: entityName,
        keyword: allegationKws[0],
        query: `"${name}" ${allegationKws[0]} aduan OR mangsa OR rugi OR complaint OR victim`,
        domains: COMPLAINT_DOMAINS,
      })
    }

    // Query 3: entity + allegation → no domain restriction (catches news, blogs)
    if (allegationKws.length > 1) {
      combos.push({
        entity: entityName,
        keyword: allegationKws[1],
        query: `"${name}" ${allegationKws[1]} tuduhan OR laporan OR dakwa OR tipu`,
      })
    }

    // Query 4: entity + context keyword + scam/fraud anchors
    for (const kw of contextKws.slice(0, 2)) {
      combos.push({
        entity: entityName,
        keyword: kw,
        query: `"${name}" "${kw}" scam OR tipu OR penipu OR penipuan`,
      })
    }
  }

  // Deduplicate and cap
  const seen = new Set<string>()
  return combos.filter(c => {
    if (seen.has(c.query)) return false
    seen.add(c.query)
    return true
  }).slice(0, 14)
}

export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: entities }, { data: keywords }] = await Promise.all([
      supabase.from('lead_entities').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('keywords').select('keyword').eq('is_active', true).eq('use_in_lead_search', true).order('keyword'),
    ])

    if (!entities?.length) {
      return NextResponse.json({ error: 'No search entities configured. Please add them in Admin > Lead Discovery.' }, { status: 400 })
    }
    if (!keywords?.length) {
      return NextResponse.json({ error: 'No keywords enabled for lead search. Open Keyword Library and enable keywords for lead search.' }, { status: 400 })
    }

    const kwList = keywords.map(k => k.keyword)

    const combos = entities.flatMap(entity =>
      buildAllegationQueries(entity.name, entity.aliases ?? [], kwList)
    ).slice(0, 14)

    // Run searches in parallel
    const searchResults = await Promise.all(
      combos.map(async combo => {
        const results = await tavilySearch(combo.query, combo.domains)
        return results.map(r => ({ ...r, entity: combo.entity, keyword: combo.keyword }))
      })
    )

    const rawResults = searchResults.flat()

    if (!rawResults.length) {
      return NextResponse.json({ leads: [], message: 'No results from search. Check that Tavily API key is set.' })
    }

    // Dedup by URL
    const urls = rawResults.map(r => r.url).filter(Boolean)
    const { data: existingLeads } = await supabase.from('leads').select('url').in('url', urls)
    const existingUrls = new Set((existingLeads ?? []).map(l => l.url))
    const freshResults = rawResults.filter(r => !existingUrls.has(r.url))

    if (!freshResults.length) {
      return NextResponse.json({ leads: [], message: 'All results already exist as leads. Clear old leads in Supabase to pull a new batch.' })
    }

    // Claude intent filter — STRICT: only keep posts that name the entity AND make an allegation against them
    const entityNames = entities.flatMap(e => [e.name, ...(e.aliases ?? [])]).filter(Boolean)

    const filterPrompt = `You are a claim intelligence analyst for a defamation and fraud investigation platform.

TASK: Review each search result. Keep ONLY results that meet ALL three criteria:
1. The post/article NAMES one of the subjects: ${entityNames.map(n => `"${n}"`).join(', ')}
2. The post makes an ALLEGATION, COMPLAINT, or ACCUSATION AGAINST that subject (not written by them)
3. The author is a member of the public, victim, or journalist — NOT the subject themselves

REJECT (is_allegation=false):
- Generic scam awareness pages (BBB, FCC, government sites)
- General scam discussion forums with no mention of the subject
- Posts WRITTEN BY the subject (promotional, coaching content, motivational posts)
- News about unrelated people
- Anything that doesn't specifically name one of the subjects above

ACCEPT (is_allegation=true):
- "Coach Fadzil tipu saya" → YES
- "Saya mangsa Botak penipu" → YES
- Post about Fadzil Affandi MLM fraud complaints → YES
- Reddit BBB scam report page (no subject named) → NO
- FCC scam glossary → NO

For each result return JSON:
{ index, is_allegation, narrative, ai_priority, ai_notes, author }

- narrative: short English label like "Ponzi fraud accusation" or "Investment scam complaint" (null if rejected)
- ai_priority: "high" = specific victim with details, "medium" = general complaint/allegation, "low" = vague mention (null if rejected)
- ai_notes: one sentence WHY you accepted or rejected
- author: name of the accuser if identifiable (null otherwise)

Return ONLY a JSON array.

Results:
${freshResults.map((r, i) => `[${i}] title: ${r.title}
url: ${r.url}
snippet: ${r.content?.slice(0, 400) ?? ''}
entity searched: ${r.entity}`).join('\n\n')}`

    let enriched: {
      index: number
      is_allegation: boolean
      narrative: string | null
      ai_priority: string | null
      ai_notes: string
      author: string | null
    }[] = []

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8000,
        messages: [{ role: 'user', content: filterPrompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) enriched = JSON.parse(match[0])
    } catch (e) {
      console.error('Claude filter error:', e)
    }

    // If AI worked, only keep confirmed allegations. If AI failed entirely, save nothing (don't pollute with junk).
    const aiWorked = enriched.length > 0
    if (!aiWorked) {
      return NextResponse.json({ leads: [], message: 'AI filter failed. No leads saved to prevent junk data.' })
    }

    const allegationResults = freshResults.filter((_, i) => {
      const ai = enriched.find(e => e.index === i)
      return ai?.is_allegation === true
    })

    if (!allegationResults.length) {
      return NextResponse.json({ leads: [], message: 'No allegation-related results found in this batch. The AI filtered all results as irrelevant. Try again for a new batch.' })
    }

    const { data: batch } = await supabase
      .from('lead_batches')
      .insert({
        run_by_id: user.id,
        query_count: combos.length,
        lead_count: allegationResults.length,
        queries_used: combos.map(c => c.query),
      })
      .select()
      .single()

    const leadsToInsert = allegationResults.map(r => {
      const origIndex = freshResults.indexOf(r)
      const ai = enriched.find(e => e.index === origIndex)
      return {
        batch_id: batch?.id ?? null,
        platform: detectPlatform(r.url),
        url: r.url,
        author: ai?.author ?? null,
        title: r.title,
        snippet: r.content?.slice(0, 500) ?? null,
        matched_entity: r.entity,
        matched_keyword: r.keyword,
        narrative: ai?.narrative ?? null,
        ai_priority: (ai?.ai_priority as 'high' | 'medium' | 'low') ?? 'medium',
        ai_notes: ai?.ai_notes ?? null,
        published_date: r.published_date ?? null,
        status: 'new',
      }
    })

    const { data: newLeads, error } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ leads: newLeads ?? [] })
  } catch (e) {
    console.error('Lead search error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
