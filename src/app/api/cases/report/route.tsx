import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import React from 'react'
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ── Colours ──────────────────────────────────────────────────────────
const RED    = '#CC0000'
const GOLD   = '#B8860B'
const DARK   = '#1E293B'
const MID    = '#334155'
const LIGHT  = '#94A3B8'
const BG     = '#F8FAFC'
const WHITE  = '#FFFFFF'

// ── Styles ────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: DARK,
    paddingTop: 72,
    paddingBottom: 52,
    paddingHorizontal: 40,
  },
  watermark: {
    position: 'absolute',
    top: '38%',
    left: '-2%',
    fontSize: 80,
    color: 'rgba(200,0,0,0.05)',
    fontFamily: 'Helvetica-Bold',
    transform: 'rotate(-45deg)',
  },
  // Header (fixed = repeats on every page)
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: RED,
    backgroundColor: WHITE,
  },
  logo: { width: 130, height: 44, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end' },
  reportTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK },
  caseId: { fontSize: 10, color: RED, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  generatedAt: { fontSize: 7, color: LIGHT, marginTop: 2 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: WHITE,
  },
  footerText: { fontSize: 6, color: LIGHT },
  footerConfidential: { fontSize: 7, color: RED, fontFamily: 'Helvetica-Bold' },
  // Sections
  section: { marginBottom: 18 },
  sectionHeader: {
    backgroundColor: RED,
    color: WHITE,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '5 10',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  // Field rows
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, color: LIGHT, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  value: { flex: 1, color: DARK, fontSize: 8 },
  // Summary box
  summaryBox: {
    backgroundColor: BG,
    borderLeftWidth: 3,
    borderLeftColor: RED,
    padding: 10,
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: LIGHT, marginBottom: 4 },
  summaryText: { fontSize: 9, color: DARK, lineHeight: 1.5 },
  // Scores
  scoreRow: { flexDirection: 'row', marginBottom: 8 },
  scoreBox: {
    flex: 1,
    marginHorizontal: 2,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    alignItems: 'center',
  },
  scoreValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: RED },
  scoreLabel: { fontSize: 6, color: LIGHT, textAlign: 'center', marginTop: 2 },
  // Keyword table
  kwHeader: {
    flexDirection: 'row',
    backgroundColor: MID,
    padding: '4 6',
    marginBottom: 1,
  },
  kwRow: {
    flexDirection: 'row',
    padding: '3 6',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  kwC1: { flex: 2, fontSize: 7, color: DARK },
  kwC2: { flex: 1, fontSize: 7, color: DARK },
  kwC3: { flex: 1, fontSize: 7, color: DARK, textAlign: 'center' },
  kwH: { color: WHITE, fontFamily: 'Helvetica-Bold' },
  // Evidence
  evidenceImage: { maxWidth: '100%', marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', objectFit: 'contain' },
  severityPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
})

// ── Helpers ───────────────────────────────────────────────────────────
function severityBg(s: string | null) {
  if (s === 'RED')    return '#DC2626'
  if (s === 'ORANGE') return '#EA580C'
  if (s === 'YELLOW') return '#CA8A04'
  if (s === 'BLUE')   return '#2563EB'
  return '#64748B'
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value && value !== '0') return null
  return (
    <View style={S.row}>
      <Text style={S.label}>{label}</Text>
      <Text style={S.value}>{value}</Text>
    </View>
  )
}

// ── PDF Document ──────────────────────────────────────────────────────
function CaseReport({ c, scores, evidence, keywords, logoSrc, generatedBy, generatedAt }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any; scores: any; evidence: any[]; keywords: any[]; logoSrc: string; generatedBy: string; generatedAt: string
}) {
  const acc = c.accounts ?? null

  return (
    <Document title={`${c.case_number} — Intelligence Report`} author="Claim Intelligence Tracker">
      <Page size="A4" style={S.page} wrap>

        {/* Watermark */}
        <Text style={S.watermark} fixed>CONFIDENTIAL</Text>

        {/* Header */}
        <View style={S.header} fixed>
          <Image style={S.logo} src={logoSrc} />
          <View style={S.headerRight}>
            <Text style={S.reportTitle}>Intelligence Case Report</Text>
            <Text style={S.caseId}>{c.case_number}</Text>
            <Text style={S.generatedAt}>Generated {generatedAt} · By {generatedBy}</Text>
          </View>
        </View>

        {/* ── Section 1: Case Summary ── */}
        <View style={S.section}>
          <Text style={S.sectionHeader}>01  CASE SUMMARY</Text>

          <View style={[S.row, { marginBottom: 8 }]}>
            <Text style={S.label}>Severity</Text>
            <View style={[S.severityPill, { backgroundColor: severityBg(c.severity_color) }]}>
              <Text style={{ color: WHITE, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{c.severity_color ?? '—'}</Text>
            </View>
          </View>

          <Field label="Status"         value={c.status?.replace(/_/g, ' ').toUpperCase()} />
          <Field label="Platform"       value={c.platforms?.name} />
          <Field label="Topic"          value={c.topics?.name} />
          <Field label="Source Type"    value={c.source_type?.replace(/_/g, ' ')} />
          <Field label="Date Found"     value={c.date_found ? new Date(c.date_found).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
          <Field label="Source URL"     value={c.url} />
          <Field label="Investigator"   value={c.profiles?.full_name ?? c.profiles?.email} />
        </View>

        {/* ── Section 2: Claim Details ── */}
        <View style={S.section}>
          <Text style={S.sectionHeader}>02  CLAIM DETAILS</Text>

          {c.focus_subject && (
            <View style={[S.summaryBox, { borderLeftColor: GOLD, marginBottom: 10 }]}>
              <Text style={[S.summaryLabel, { color: GOLD }]}>FOCUS SUBJECT</Text>
              <Text style={S.summaryText}>{c.focus_subject}</Text>
              {c.focus_comment && (
                <Text style={[S.summaryText, { marginTop: 6, fontFamily: 'Helvetica-Oblique', color: MID }]}>
                  &ldquo;{c.focus_comment}&rdquo;
                </Text>
              )}
            </View>
          )}

          {c.ai_summary && (
            <View style={S.summaryBox}>
              <Text style={S.summaryLabel}>AI CLAIM SUMMARY</Text>
              <Text style={S.summaryText}>{c.ai_summary}</Text>
            </View>
          )}

          <Field label="Post Author"      value={c.post_owner_name} />
          <Field label="Post Date & Time" value={c.post_datetime ? new Date(c.post_datetime).toLocaleString('en-MY') : null} />
          <Field label="Reactions"        value={c.emoji_count > 0 ? String(c.emoji_count) : null} />
          <Field label="Comments"         value={c.post_comments > 0 ? String(c.post_comments) : null} />
          <Field label="Shares"           value={c.post_shares > 0 ? String(c.post_shares) : null} />
          <Field label="Claim Category"   value={c.claim_category} />

          {c.initial_notes && (
            <View style={[S.summaryBox, { marginTop: 6 }]}>
              <Text style={S.summaryLabel}>INVESTIGATOR NOTES</Text>
              <Text style={S.summaryText}>{c.initial_notes}</Text>
            </View>
          )}

          {c.full_claim_text && (
            <View style={[S.summaryBox, { marginTop: 6 }]}>
              <Text style={S.summaryLabel}>FULL CLAIM TEXT</Text>
              <Text style={S.summaryText}>{c.full_claim_text}</Text>
            </View>
          )}
        </View>

        {/* ── Section 3: Subject / Account ── */}
        {acc && (
          <View style={S.section}>
            <Text style={S.sectionHeader}>03  SUBJECT / ACCOUNT</Text>
            <Field label="Full Name"              value={acc.name} />
            <Field label="Username / Handle"      value={acc.username ? `@${acc.username}` : null} />
            <Field label="IC / ID Number"         value={acc.ic_number} />
            <Field label="Email Address"          value={acc.email_address} />
            <Field label="Phone Number 1"         value={acc.phone_number} />
            <Field label="Phone Number 2"         value={acc.phone_number_2} />
            <Field label="Website"               value={acc.website} />
            <Field label="Profile URL"            value={acc.profile_url} />
            <Field label="Home Address"           value={acc.address} />
            <Field label="Office Address"         value={acc.office_address} />
            <Field label="Business Details"       value={acc.business_details} />
            <Field label="Workplace"              value={acc.workplace} />
            <Field label="Company"                value={acc.company} />
            <Field label="Followers"              value={acc.followers != null ? Number(acc.followers).toLocaleString() : null} />
            <Field label="Following"              value={acc.following != null ? Number(acc.following).toLocaleString() : null} />
            <Field label="Verified"               value={acc.is_verified ? 'Yes' : 'No'} />
            {acc.notes && (
              <View style={[S.summaryBox, { marginTop: 6 }]}>
                <Text style={S.summaryLabel}>ACCOUNT NOTES</Text>
                <Text style={S.summaryText}>{acc.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Section 4: Risk Scores ── */}
        {scores && (
          <View style={S.section}>
            <Text style={S.sectionHeader}>04  RISK ASSESSMENT</Text>
            <View style={S.scoreRow}>
              {[
                { label: 'Overall Priority',    value: scores.overall_priority_score },
                { label: 'Claim Seriousness',   value: scores.claim_seriousness_score },
                { label: 'Reputation Impact',   value: scores.reputation_impact_score },
                { label: 'Influence',           value: scores.influence_score },
                { label: 'Evidence Strength',   value: scores.evidence_strength_score },
                { label: 'Legal Exposure',      value: scores.legal_exposure_score },
              ].map((s, i) => (
                <View key={i} style={S.scoreBox}>
                  <Text style={S.scoreValue}>{s.value ?? 0}</Text>
                  <Text style={S.scoreLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
            {scores.legal_review_status && scores.legal_review_status !== 'Not Required' && (
              <View style={[S.summaryBox, { borderLeftColor: '#DC2626' }]}>
                <Text style={[S.summaryLabel, { color: '#DC2626' }]}>LEGAL REVIEW: {scores.legal_review_status}</Text>
                {scores.score_explanation && <Text style={S.summaryText}>{scores.score_explanation}</Text>}
                {scores.reputation_attack_reasoning && (
                  <Text style={[S.summaryText, { marginTop: 4, color: MID }]}>{scores.reputation_attack_reasoning}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Section 5: Keywords ── */}
        {keywords.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHeader}>05  DETECTED KEYWORDS</Text>
            <View style={S.kwHeader}>
              <Text style={[S.kwC1, S.kwH]}>Keyword</Text>
              <Text style={[S.kwC2, S.kwH]}>Type</Text>
              <Text style={[S.kwC3, S.kwH]}>Freq.</Text>
              <Text style={[S.kwC3, S.kwH]}>Seriousness</Text>
              <Text style={[S.kwC3, S.kwH]}>Rep. Score</Text>
            </View>
            {keywords.map((kw, i) => (
              <View key={i} style={[S.kwRow, { backgroundColor: i % 2 === 0 ? WHITE : BG }]}>
                <Text style={S.kwC1}>{kw.keywords?.keyword ?? kw.keyword ?? '—'}</Text>
                <Text style={S.kwC2}>{kw.keywords?.keyword_type ?? kw.keyword_type ?? '—'}</Text>
                <Text style={S.kwC3}>{kw.frequency ?? '—'}</Text>
                <Text style={S.kwC3}>{kw.keywords?.seriousness_score ?? '—'}</Text>
                <Text style={S.kwC3}>{kw.keywords?.reputation_score ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Section 6: Evidence ── */}
        {evidence.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHeader}>06  EVIDENCE</Text>
            {evidence.map((ev, i) => (
              <View key={i} style={{ marginBottom: 12 }}>
                <Field
                  label={`File ${i + 1}`}
                  value={`${ev.file_name ?? 'Unknown'} · ${ev.evidence_type ?? ''} · ${ev.created_at ? new Date(ev.created_at).toLocaleDateString('en-MY') : ''}`}
                />
                {ev.evidence_type === 'screenshot' && ev.file_url && (
                  <Image src={ev.file_url} style={S.evidenceImage} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{c.case_number} — Claim Intelligence Tracker</Text>
          <Text style={S.footerConfidential}>CONFIDENTIAL — INTERNAL USE ONLY</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ── Route handler ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const caseId = req.nextUrl.searchParams.get('id')
  if (!caseId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Fetch all case data
  const [
    { data: c },
    { data: scores },
    { data: evidence },
    { data: keywords },
    { data: profile },
  ] = await Promise.all([
    supabase.from('cases').select(`
      *, platforms(name), topics(name),
      accounts(*, account_types(name)),
      profiles!assigned_investigator_id(full_name, email)
    `).eq('id', caseId).single(),
    supabase.from('case_scores').select('*').eq('case_id', caseId).maybeSingle(),
    supabase.from('evidence').select('*').eq('case_id', caseId).order('created_at'),
    supabase.from('case_keyword_matches').select('*, keywords(keyword, keyword_type, seriousness_score, reputation_score)').eq('case_id', caseId).order('frequency', { ascending: false }),
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ])

  if (!c) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  // Load logo as base64
  const logoPath = path.join(process.cwd(), 'public', 'cit-logo.png')
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : ''

  const generatedAt = new Date().toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  function maskEmail(email: string) {
    const [local, domain] = email.split('@')
    if (!domain || local.length <= 2) return email
    return `${local[0]}${'x'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
  }
  const rawBy = profile?.full_name ?? profile?.email ?? 'Unknown'
  const generatedBy = profile?.full_name ? rawBy : (profile?.email ? maskEmail(profile.email) : 'Unknown')

  const pdfBuffer = await renderToBuffer(
    <CaseReport
      c={c}
      scores={scores}
      evidence={evidence ?? []}
      keywords={keywords ?? []}
      logoSrc={logoBase64}
      generatedBy={generatedBy}
      generatedAt={generatedAt}
    />
  )

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${c.case_number}-report.pdf"`,
    },
  })
}
