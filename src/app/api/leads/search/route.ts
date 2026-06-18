import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
    }),
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
  try { return new URL(url).hostname.replace('www.', '') } catch { return 'Web' }
}

export async function POST() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load active entities and keywords flagged for lead search
    const [{ data: entities }, { data: keywords }] = await Promise.all([
      supabase.from('lead_entities').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('keywords').select('keyword').eq('is_active', true).eq('use_in_lead_search', true).order('keyword'),
    ])

    if (!entities?.length) {
      return NextResponse.json({ error: 'No search entities configured. Please add them in Admin > Lead Discovery.' }, { status: 400 })
    }
    if (!keywords?.length) {
      return NextResponse.json({ error: 'No keywords enabled for lead search. Open Keyword Library and toggle the radar icon on keywords you want to use.' }, { status: 400 })
    }

    // Build query combinations (entity × keyword), take up to 4 combos for 20 results
    const combos: { entity: string; keyword: string; query: string }[] = []
    for (const entity of entities.slice(0, 2)) {
      for (const kw of keywords.slice(0, 2)) {
        combos.push({
          entity: entity.name,
          keyword: kw.keyword,
          query: `"${entity.name}" ${kw.keyword} site:facebook.com OR site:twitter.com OR site:tiktok.com OR site:reddit.com`,
        })
      }
    }
    // Also do plain web search without site restriction for diversity
    for (const entity of entities.slice(0, 1)) {
      for (const kw of keywords.slice(2, 4)) {
        combos.push({
          entity: entity.name,
          keyword: kw.keyword,
          query: `"${entity.name}" "${kw.keyword}"`,
        })
      }
    }

    // Run Tavily searches in parallel
    const searchResults = await Promise.all(
      combos.map(async combo => {
        const results = await tavilySearch(combo.query)
        return results.map(r => ({ ...r, entity: combo.entity, keyword: combo.keyword }))
      })
    )

    const rawResults = searchResults.flat().slice(0, 20)

    if (!rawResults.length) {
      return NextResponse.json({ leads: [], message: 'No results from search.' })
    }

    // Check existing URLs to avoid duplicates
    const urls = rawResults.map(r => r.url).filter(Boolean)
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('url')
      .in('url', urls)

    const existingUrls = new Set((existingLeads ?? []).map(l => l.url))
    const freshResults = rawResults.filter(r => !existingUrls.has(r.url))

    if (!freshResults.length) {
      return NextResponse.json({ leads: [], message: 'All results already exist as leads.' })
    }

    // AI enrichment: detect narrative + priority for each result
    const enrichPrompt = `You are a claim intelligence analyst. For each search result below, identify:
1. narrative: a short label for the type of allegation (e.g. "Ponzi scheme claim", "MLM fraud allegation", "money not returned", "defamation")
2. ai_priority: "high", "medium", or "low" based on how serious/credible the lead appears
3. ai_notes: one sentence about why this is worth investigating or not
4. author: extract the likely author/account name from the title or snippet if identifiable, else null

Return a JSON array with objects: { index, narrative, ai_priority, ai_notes, author }

Results:
${freshResults.map((r, i) => `[${i}] title: ${r.title}\nsnippet: ${r.content?.slice(0, 200)}\nurl: ${r.url}\nentity: ${r.entity}\nkeyword: ${r.keyword}`).join('\n\n')}`

    let enriched: { index: number; narrative: string; ai_priority: string; ai_notes: string; author: string | null }[] = []
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: enrichPrompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) enriched = JSON.parse(match[0])
    } catch {
      // If AI enrichment fails, continue with defaults
    }

    // Create batch record
    const { data: batch } = await supabase
      .from('lead_batches')
      .insert({
        run_by_id: user.id,
        query_count: combos.length,
        lead_count: freshResults.length,
        queries_used: combos.map(c => c.query),
      })
      .select()
      .single()

    // Insert leads
    const leadsToInsert = freshResults.map((r, i) => {
      const ai = enriched.find(e => e.index === i)
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
