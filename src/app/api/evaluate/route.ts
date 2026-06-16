import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EVIDENCE_SCORE: Record<string, number> = { E5: 100, E4: 80, E3: 60, E2: 40, E1: 20 }
const HARMFUL_TYPES = ['Allegation', 'Legal', 'Financial', 'Business Dispute', 'Reputation Attack']

function calcEngagementScore(reactions: number, comments: number, shares: number): number {
  // Shares = virality (highest weight), Comments = discussion depth, Reactions = broad reach
  const shareScore    = Math.min(40, Math.round(shares / 5))       // max 40 pts at 200 shares
  const commentScore  = Math.min(35, Math.round(comments / 6))     // max 35 pts at 210 comments
  const reactionScore = Math.min(25, Math.round(reactions / 60))   // max 25 pts at 1500 reactions
  return shareScore + commentScore + reactionScore
}

function engagementLabel(score: number): { level: string; colour: string } {
  if (score >= 70) return { level: 'Critical', colour: 'RED' }
  if (score >= 50) return { level: 'High',     colour: 'ORANGE' }
  if (score >= 30) return { level: 'Medium',   colour: 'YELLOW' }
  return             { level: 'Low',            colour: 'BLUE' }
}

function priorityColour(score: number): string {
  if (score >= 90) return 'DARK_RED'
  if (score >= 75) return 'RED'
  if (score >= 50) return 'ORANGE'
  if (score >= 25) return 'YELLOW'
  return 'BLUE'
}

function legalReviewStatus(score: number): string {
  if (score >= 70) return 'Urgent Legal Review'
  if (score >= 40) return 'Review Suggested'
  return 'Not Required'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, platform, notes, caseId, images, imageBase64, imageMediaType, focusSubject } = await req.json()
  // Support both old single-image format and new multi-image array
  const imageList: { data: string; mediaType: string }[] = images ??
    (imageBase64 ? [{ data: imageBase64, mediaType: imageMediaType ?? 'image/jpeg' }] : [])

  // Fetch active AI prompt
  const { data: promptConfig } = await supabase
    .from('ai_prompts')
    .select('system_prompt, user_prompt_template')
    .eq('prompt_type', 'case_evaluation')
    .eq('is_active', true)
    .single()

  const systemPrompt = promptConfig?.system_prompt ??
    `You are an expert intelligence analyst for a reputation monitoring platform. Your PRIMARY purpose is to detect, classify, and score online posts that make negative claims — direct or indirect — about specific entities: Coach Fadzil, Brainy Bunch, Malakat, Tea Amo, Quantum Metal (QM), Eastel, DRE Coffee, LHDN.

KEY PRINCIPLES:
1. Sarcasm counts as a claim. "Terbaik Coach 👊" in a post implying hypocrisy IS a reputation attack — treat it as one.
2. Implication counts. A post saying "Coach champions Buy Muslim First but now promotes a Chinese-owned company" damages reputation even without the word "hypocrite".
3. Context matters for denial. "Saya tidak tuduh X jalankan perniagaan scam" means the person is NOT accusing — do NOT count "scam" as an allegation in that context.
4. The crowd's label matters. If a post frames an entity as a hypocrite, liar, scammer, or untrustworthy — even sarcastically — that IS the claim being made.
5. Malay/informal language: keldai (used as fool/stooge), hipokrit, penipu, tipu, syok sendiri, bodoh, hina — these are reputation attack terms when directed at an entity.

Always assess: Is this post damaging the reputation of a monitored entity? Score reputation_attack_score 0–100 accordingly.`

  const userPrompt = (promptConfig?.user_prompt_template ?? `Analyze this post:\nURL: {{url}}\nPlatform: {{platform}}\nNotes: {{notes}}\n\nReturn JSON only.`)
    .replace('{{url}}', url ?? 'Not provided')
    .replace('{{platform}}', platform ?? 'Unknown')
    .replace('{{notes}}', notes ?? 'None')

  const focusInstruction = focusSubject
    ? `\n\n⚠️ FOCUS SUBJECT OVERRIDE: This case is NOT about the main post author. The investigator wants to focus specifically on: "${focusSubject}"\n\nYour entire analysis must centre on what "${focusSubject}" said in the comments or elsewhere in the screenshot:\n- Find their comment(s) and treat that text as THE CLAIM being investigated\n- Write the summary about what "${focusSubject}" said/alleged — not the main poster\n- Set post_owner_name to "${focusSubject}" (the focus subject), not the main post author\n- Extract account_username, account_followers, account_is_verified for "${focusSubject}" if visible\n- Score severity, seriousness, and reputation impact based on THEIR statement\n- extracted_text must include their comment verbatim`
    : ''

  const imageInstruction = imageList.length > 0
    ? `\n\n${imageList.length > 1 ? `${imageList.length} screenshots have been provided. They may show different parts of the same case — e.g. the post on one image, the account profile on another, comments on another. Treat them as a combined evidence set and extract all available information across ALL images.` : 'A screenshot of the post has been provided.'}

Read ALL visible text across every image — including sidebars, captions, comment panels, right-side panels, profile pages, and any text outside the main document.

IMPORTANT: Facebook photo viewer shows the image on the LEFT and the post caption/comments on the RIGHT. You must read BOTH sides. If one screenshot shows the author's profile (followers, bio, cover photo), extract account details from it even if the post content is on a different screenshot.

Extract these fields by combining information from ALL screenshots:
- extracted_text: Transcribe EVERY word visible across ALL screenshots. Include: post caption text, author name, all body text, document text, comments, hashtags, names, company names, single words like "Coach", "scam", slang, Malay/Indonesian words. This field is used for keyword matching — completeness is critical.
- post_owner_name: the name or username of the person who made the post (check all images)
- post_datetime: date and time the post was published (ISO 8601, e.g. "2024-05-26T19:56:00")
- emoji_count: total reaction/like count — scan ALL screenshots for the engagement bar and use the highest or most complete value found. (e.g. 775)
- post_comments: the count next to the speech-bubble / comment icon — the SECOND number in Facebook's engagement bar [reactions 💬comments ↗shares]. Check ALL screenshots. Example "775 130 💬 86 ↗" → post_comments = 130.
- post_shares: the THIRD number in that engagement row — check ALL screenshots. Example "775 130 💬 86 ↗" → post_shares = 86.
- account_username: the @handle or username of the post author (check profile screenshots), or null
- account_profile_url: the full profile URL if visible in any screenshot, or null
- account_followers: follower/friend count if shown in any profile screenshot, or null
- account_is_verified: true if there is a blue verified tick next to the author's name in any screenshot, otherwise false
If any value cannot be read across all images, return null or 0.${focusInstruction}`
    : focusInstruction

  const fullPrompt = `${userPrompt}${imageInstruction}

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
  "overall_risk_score": 50,
  "reputation_attack_score": 0,
  "reputation_attack_reasoning": "explain whether and how this post damages a monitored entity's reputation, including sarcasm and implication",
  "post_owner_name": "name of the post author if identifiable, or null",
  "post_datetime": "ISO 8601 datetime if mentioned in the post, or null",
  "emoji_count": 0,
  "post_comments": 0,
  "post_shares": 0,
  "extracted_text": "all visible text from the post including captions, comments, labels, names — as a single string",
  "account_username": "the @handle or username of the post author, or null",
  "account_profile_url": "full profile URL if visible, or null",
  "account_followers": null,
  "account_is_verified": false
}`

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    for (const img of imageList) {
      const safeType = validTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg'
      content.push({ type: 'image', source: { type: 'base64', media_type: safeType, data: img.data } })
    }
    content.push({ type: 'text', text: fullPrompt })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
      system: systemPrompt,
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0])

    // --- Keyword Detection ---
    const { data: activeKeywords } = await supabase
      .from('keywords')
      .select('id, keyword, keyword_type, severity_score, seriousness_score, reputation_score, color_tag, reputation_impact, is_legal_flag, group_id')
      .eq('is_active', true)

    // Only scan actual source content — NOT AI-generated summary/keywords (circular false positives)
    const textToScan = [url ?? '', notes ?? '', parsed.extracted_text ?? ''].join(' ').toLowerCase()
    console.log('[CIT] extracted_text:', parsed.extracted_text)
    console.log('[CIT] textToScan (first 500):', textToScan.slice(0, 500))

    type DetectedKw = {
      keyword_id: string
      keyword: string
      keyword_type: string
      frequency: number
      seriousness_score: number
      reputation_score: number
      severity_score: number
      color_tag: string
      reputation_impact: string
      is_legal_flag: boolean
    }

    const entities: DetectedKw[] = []
    const harmful: DetectedKw[] = []
    const neutral: DetectedKw[] = []

    for (const kw of (activeKeywords ?? [])) {
      const regex = new RegExp(`\\b${kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = textToScan.match(regex)
      if (!matches || matches.length === 0) continue

      const entry: DetectedKw = {
        keyword_id: kw.id,
        keyword: kw.keyword,
        keyword_type: kw.keyword_type ?? 'Custom',
        frequency: matches.length,
        seriousness_score: kw.seriousness_score ?? 0,
        reputation_score: kw.reputation_score ?? 0,
        severity_score: kw.severity_score ?? 0,
        color_tag: kw.color_tag,
        reputation_impact: kw.reputation_impact,
        is_legal_flag: kw.is_legal_flag,
      }

      if (kw.keyword_type === 'Entity') {
        entities.push(entry)
      } else if (HARMFUL_TYPES.includes(kw.keyword_type ?? '')) {
        harmful.push(entry)
      } else {
        neutral.push(entry)
      }
    }

    // --- Fetch score weights ---
    const { data: weights } = await supabase
      .from('score_weights')
      .select('*')
      .eq('is_active', true)
      .single()

    const w = {
      claim_seriousness: Number(weights?.claim_seriousness_weight ?? 0.25),
      reputation_impact: Number(weights?.reputation_impact_weight ?? 0.20),
      influence: Number(weights?.influence_weight ?? 0.20),
      evidence_strength: Number(weights?.evidence_strength_weight ?? 0.15),
      narrative_amplification: Number(weights?.narrative_amplification_weight ?? 0.10),
      legal_exposure: Number(weights?.legal_exposure_weight ?? 0.10),
    }

    // --- A. Claim Seriousness Score ---
    // Weighted average: divide by total frequency so repeated keywords don't inflate score
    const allegationKws = harmful.filter(k => ['Allegation', 'Legal', 'Financial', 'Business Dispute'].includes(k.keyword_type))
    const allegationTotalFreq = allegationKws.reduce((s, k) => s + k.frequency, 0)
    const claimSeriousnessScore = allegationTotalFreq === 0 ? 0 :
      Math.min(100, Math.round(allegationKws.reduce((s, k) => s + k.seriousness_score * k.frequency, 0) / allegationTotalFreq))

    // --- B. Reputation Impact Score ---
    // Blend keyword-based score (70%) with AI's context-aware reputation assessment (30%)
    // AI score captures sarcasm, implication, and negated denials that keywords miss
    const repKws = harmful.filter(k => k.keyword_type === 'Reputation Attack')
    const repTotalFreq = repKws.reduce((s, k) => s + k.frequency, 0)
    const keywordRepScore = repTotalFreq === 0 ? 0 :
      Math.min(100, Math.round(repKws.reduce((s, k) => s + k.reputation_score * k.frequency, 0) / repTotalFreq))
    const aiRepScore = Math.min(100, Math.max(0, parsed.reputation_attack_score ?? 0))
    // If AI detects reputation attack but no keywords matched, use AI score directly
    const reputationImpactScore = repTotalFreq === 0
      ? aiRepScore
      : Math.round(keywordRepScore * 0.7 + aiRepScore * 0.3)

    // --- C. Influence Score — blend AI level with real engagement data ---
    const reactions = parsed.emoji_count ?? 0
    const comments  = parsed.post_comments ?? 0
    const shares    = parsed.post_shares ?? 0
    const engagementScore = calcEngagementScore(reactions, comments, shares)
    const engagementInfo  = engagementLabel(engagementScore)
    const aiInfluence     = Math.min(100, Math.round((parsed.influence_level ?? 1) * 20))
    // If real engagement data exists, weight it 70%; otherwise use AI estimate alone
    const hasEngagement = reactions > 0 || comments > 0 || shares > 0
    const influenceScore = hasEngagement
      ? Math.round(engagementScore * 0.7 + aiInfluence * 0.3)
      : aiInfluence

    // --- D. Evidence Strength Score ---
    const evidenceStrengthScore = EVIDENCE_SCORE[parsed.evidence_level ?? 'E1'] ?? 20

    // --- E. Narrative Amplification Score ---
    // Count how many existing cases share the same harmful keyword
    let narrativeScore = 0
    if (caseId && harmful.length > 0) {
      const harmfulIds = harmful.map(k => k.keyword_id)
      const { count } = await supabase
        .from('case_keyword_matches')
        .select('case_id', { count: 'exact', head: true })
        .in('keyword_id', harmfulIds)
        .neq('case_id', caseId)
      narrativeScore = Math.min(100, Math.round((count ?? 0) * 10))
    }

    // --- F. Legal Exposure Score ---
    // Only meaningful when entity + harmful both detected
    let legalExposureScore = 0
    if (entities.length > 0 && harmful.length > 0) {
      const maxHarmful = Math.max(...harmful.map(k => Math.max(k.seriousness_score, k.reputation_score)))
      legalExposureScore = Math.min(100, Math.round(40 + maxHarmful * 0.4 + influenceScore * 0.2))
    }

    // --- G. Overall Priority Score ---
    const overallPriorityScore = Math.round(
      claimSeriousnessScore * w.claim_seriousness +
      reputationImpactScore * w.reputation_impact +
      influenceScore * w.influence +
      evidenceStrengthScore * w.evidence_strength +
      narrativeScore * w.narrative_amplification +
      legalExposureScore * w.legal_exposure
    )

    const colour = priorityColour(overallPriorityScore)
    const reviewStatus = legalReviewStatus(legalExposureScore)

    // --- Build explanation ---
    const entityNames = entities.map(k => k.keyword).join(', ')
    const harmfulTerms = harmful.map(k => k.keyword).join(', ')
    let scoreExplanation = ''
    if (reviewStatus !== 'Not Required' && entities.length > 0) {
      scoreExplanation = `${reviewStatus}: post names ${entityNames} alongside harmful keywords (${harmfulTerms}).`
    } else if (entities.length > 0 && harmful.length === 0) {
      scoreExplanation = `Entity detected (${entityNames}) with no harmful allegations. Low priority.`
    } else if (entities.length === 0 && harmful.length > 0) {
      scoreExplanation = `Harmful keywords detected (${harmfulTerms}) but no named entity identified.`
    } else if (harmful.length > 0) {
      scoreExplanation = `Harmful keywords found: ${harmfulTerms}.`
    } else {
      scoreExplanation = 'No significant keywords detected. Low priority.'
    }

    // --- Persist to DB ---
    if (caseId) {
      const now = new Date().toISOString()
      const allDetected = [...entities, ...harmful, ...neutral]

      if (allDetected.length > 0) {
        await supabase.from('case_keyword_matches').upsert(
          allDetected.map(d => ({
            case_id: caseId,
            keyword_id: d.keyword_id,
            frequency: d.frequency,
            detected_from: 'ai_evaluation',
            first_detected_at: now,
          })),
          { onConflict: 'case_id,keyword_id' }
        )
      }

      await supabase.from('case_scores').upsert({
        case_id: caseId,
        claim_seriousness_score: claimSeriousnessScore,
        reputation_impact_score: reputationImpactScore,
        influence_score: influenceScore,
        evidence_strength_score: evidenceStrengthScore,
        narrative_amplification_score: narrativeScore,
        legal_exposure_score: legalExposureScore,
        overall_priority_score: overallPriorityScore,
        priority_colour: colour,
        legal_review_status: reviewStatus,
        score_explanation: scoreExplanation,
        reputation_attack_reasoning: parsed.reputation_attack_reasoning ?? null,
        detected_entities: entities,
        detected_harmful: harmful,
        updated_at: now,
      }, { onConflict: 'case_id' })

      await supabase.from('cases').update({
        keyword_heat_score: overallPriorityScore,
        legal_review_recommended: reviewStatus !== 'Not Required',
        post_owner_name: parsed.post_owner_name ?? null,
        post_datetime: parsed.post_datetime ?? null,
        emoji_count: parsed.emoji_count ?? 0,
        post_comments: parsed.post_comments ?? 0,
        post_shares: parsed.post_shares ?? 0,
      }).eq('id', caseId)
    }

    return NextResponse.json({
      ...parsed,
      post_owner_name: parsed.post_owner_name ?? null,
      post_datetime: parsed.post_datetime ?? null,
      emoji_count: parsed.emoji_count ?? 0,
      post_comments: parsed.post_comments ?? 0,
      post_shares: parsed.post_shares ?? 0,
      extracted_text: parsed.extracted_text ?? null,
      account_username: parsed.account_username ?? null,
      account_profile_url: parsed.account_profile_url ?? null,
      account_followers: parsed.account_followers ?? null,
      account_is_verified: parsed.account_is_verified ?? false,
      engagement_score: engagementScore,
      engagement_level: engagementInfo.level,
      engagement_colour: engagementInfo.colour,
      entities,
      harmful_keywords: harmful,
      claim_seriousness_score: claimSeriousnessScore,
      reputation_impact_score: reputationImpactScore,
      influence_score: influenceScore,
      evidence_strength_score: evidenceStrengthScore,
      narrative_amplification_score: narrativeScore,
      legal_exposure_score: legalExposureScore,
      overall_priority_score: overallPriorityScore,
      priority_colour: colour,
      legal_review_status: reviewStatus,
      score_explanation: scoreExplanation,
    })
  } catch (err: unknown) {
    console.error('AI evaluation error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 500 })
  }
}
