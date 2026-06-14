import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, platform, notes, caseId } = await req.json()

  // Fetch active AI prompt from DB
  const { data: promptConfig } = await supabase
    .from('ai_prompts')
    .select('system_prompt, user_prompt_template')
    .eq('prompt_type', 'case_evaluation')
    .eq('is_active', true)
    .single()

  const systemPrompt = promptConfig?.system_prompt ??
    'You are an expert intelligence analyst. Analyze online claims objectively. Never determine guilt or innocence. Extract, classify, and score information only.'

  const userPrompt = (promptConfig?.user_prompt_template ?? `Analyze this post:\nURL: {{url}}\nPlatform: {{platform}}\nNotes: {{notes}}\n\nReturn JSON only.`)
    .replace('{{url}}', url ?? 'Not provided')
    .replace('{{platform}}', platform ?? 'Unknown')
    .replace('{{notes}}', notes ?? 'None')

  const fullPrompt = `${userPrompt}

Return ONLY valid JSON in this exact structure:
{
  "summary": "2-3 sentence objective summary",
  "claim_category": "category of claim",
  "suggested_topic": "most relevant topic",
  "severity": "RED|YELLOW|BLUE|GREY",
  "severity_reasoning": "why this severity",
  "evidence_level": "E1|E2|E3|E4|E5",
  "evidence_reasoning": "why this evidence level",
  "influence_level": 1,
  "keywords": ["keyword1", "keyword2"],
  "duplicate_notes": "any notes about similar claims or none",
  "overall_risk_score": 50
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: fullPrompt }],
      system: systemPrompt,
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    // --- Keyword Detection ---
    const { data: activeKeywords } = await supabase
      .from('keywords')
      .select('id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag, group_id, keyword_groups(name)')
      .eq('is_active', true)

    const textToScan = [url ?? '', platform ?? '', notes ?? '', parsed.summary ?? '', (parsed.keywords ?? []).join(' ')].join(' ').toLowerCase()

    const detected: { keyword_id: string; keyword: string; frequency: number; severity_score: number; color_tag: string; reputation_impact: string; is_legal_flag: boolean; group_name: string }[] = []
    let heatScore = 0
    let legalFlag = false

    for (const kw of (activeKeywords ?? [])) {
      const regex = new RegExp(`\\b${kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = textToScan.match(regex)
      if (matches && matches.length > 0) {
        detected.push({
          keyword_id: kw.id,
          keyword: kw.keyword,
          frequency: matches.length,
          severity_score: kw.severity_score,
          color_tag: kw.color_tag,
          reputation_impact: kw.reputation_impact,
          is_legal_flag: kw.is_legal_flag,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          group_name: (kw as any).keyword_groups?.name ?? 'Ungrouped',
        })
        heatScore += kw.severity_score * matches.length
        if (kw.is_legal_flag) legalFlag = true
      }
    }

    // Normalize heat score to 0-100
    const normalizedHeat = Math.min(100, Math.round(heatScore / Math.max(1, detected.length * 2)))

    // If caseId provided, persist detected keywords
    if (caseId && detected.length > 0) {
      const now = new Date().toISOString()
      await supabase.from('detected_keywords').upsert(
        detected.map(d => ({
          case_id: caseId,
          keyword_id: d.keyword_id,
          frequency: d.frequency,
          first_appearance: now,
          last_appearance: now,
        })),
        { onConflict: 'case_id,keyword_id' }
      )
      await supabase.from('cases').update({
        keyword_heat_score: normalizedHeat,
        legal_review_recommended: legalFlag,
      }).eq('id', caseId)
    }

    return NextResponse.json({
      ...parsed,
      detected_keywords: detected,
      keyword_heat_score: normalizedHeat,
      legal_review_recommended: legalFlag,
    })
  } catch (err: unknown) {
    console.error('AI evaluation error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 500 })
  }
}
