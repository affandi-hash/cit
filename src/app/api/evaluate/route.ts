import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, platform, notes } = await req.json()

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
  "duplicate_notes": "any notes about similar claims or none"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: fullPrompt }
      ],
      system: systemPrompt,
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    console.error('AI evaluation error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 500 })
  }
}
