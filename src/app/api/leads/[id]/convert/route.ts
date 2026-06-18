import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load the lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (lead.status === 'saved_to_case') return NextResponse.json({ error: 'Already converted' }, { status: 400 })

    // Find matching platform_id
    const { data: platforms } = await supabase.from('platforms').select('id, name')
    const matchedPlatform = platforms?.find(p =>
      lead.platform && p.name.toLowerCase().includes(lead.platform.toLowerCase())
    )

    // Generate case_number
    const { count } = await supabase.from('cases').select('*', { count: 'exact', head: true })
    const caseNumber = `CIT-${String((count ?? 0) + 1).padStart(6, '0')}`

    // Create the case carrying over lead data
    const { data: newCase, error: caseErr } = await supabase
      .from('cases')
      .insert({
        case_number: caseNumber,
        url: lead.url,
        platform_id: matchedPlatform?.id ?? null,
        date_found: lead.date_found,
        status: 'new',
        ai_summary: lead.snippet ?? null,
        full_claim_text: lead.snippet ?? null,
        post_owner_name: lead.author ?? null,
        keywords: lead.matched_keyword ? [lead.matched_keyword] : null,
        initial_notes: [
          lead.narrative ? `Narrative: ${lead.narrative}` : null,
          lead.ai_notes ? `AI Notes: ${lead.ai_notes}` : null,
          `Converted from lead ${lead.lead_number}`,
          `Matched entity: ${lead.matched_entity ?? '—'}`,
          `Matched keyword: ${lead.matched_keyword ?? '—'}`,
        ].filter(Boolean).join('\n'),
        severity_color: lead.ai_priority === 'high' ? 'RED' : lead.ai_priority === 'medium' ? 'YELLOW' : 'BLUE',
        source_type: 'post_owner',
      })
      .select()
      .single()

    if (caseErr || !newCase) return NextResponse.json({ error: caseErr?.message ?? 'Case creation failed' }, { status: 500 })

    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'saved_to_case',
        converted_case_id: newCase.id,
        reviewed_by_id: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ case_number: caseNumber, case_id: newCase.id })
  } catch (e) {
    console.error('Lead convert error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
