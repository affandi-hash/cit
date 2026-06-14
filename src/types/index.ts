export type UserRole = 'super_admin' | 'admin' | 'investigator' | 'viewer'

export type SeverityColor = 'RED' | 'YELLOW' | 'BLUE' | 'GREY'

export type CaseStatus =
  | 'new'
  | 'under_review'
  | 'verified'
  | 'dismissed'
  | 'escalated'
  | 'closed'

export type SourceType = 'post_owner' | 'commenter'

export type VerificationStatus = 'publicly_sourced' | 'unverified' | 'verified'

export type EvidenceType =
  | 'screenshot'
  | 'video'
  | 'audio'
  | 'document'
  | 'pdf'
  | 'other'

export type VersionChangeType =
  | 'original_post'
  | 'edited_post'
  | 'deleted_post'
  | 'new_comment'
  | 'engagement_update'
  | 'follow_up_post'
  | 'additional_evidence'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Platform {
  id: string
  name: string
  icon: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Topic {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface SeverityLevel {
  id: string
  name: string
  color: SeverityColor
  description: string | null
  examples: string[] | null
  min_score: number
  max_score: number
  sort_order: number
  is_active: boolean
}

export interface AccountType {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface Account {
  id: string
  name: string | null
  username: string | null
  profile_url: string | null
  account_type_id: string | null
  account_type?: AccountType
  followers: number | null
  following: number | null
  is_verified: boolean
  workplace: string | null
  company: string | null
  phone_number: string | null
  address: string | null
  notes: string | null
  name_status: VerificationStatus
  username_status: VerificationStatus
  workplace_status: VerificationStatus
  company_status: VerificationStatus
  phone_status: VerificationStatus
  address_status: VerificationStatus
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  case_number: string
  platform_id: string | null
  platform?: Platform
  url: string | null
  source_type: SourceType
  account_id: string | null
  account?: Account
  topic_id: string | null
  topic?: Topic
  date_found: string
  date_posted: string | null
  status: CaseStatus
  full_claim_text: string | null
  ai_summary: string | null
  claim_category: string | null
  keywords: string[] | null
  related_case_ids: string[] | null
  severity_id: string | null
  severity?: SeverityLevel
  severity_color: SeverityColor | null
  claim_seriousness_score: number | null
  evidence_strength_score: number | null
  influence_score: number | null
  engagement_score: number | null
  overall_risk_score: number | null
  influence_level: number | null
  assigned_investigator_id: string | null
  assigned_investigator?: Profile
  initial_notes: string | null
  ai_evaluated: boolean
  ai_confirmed: boolean
  created_at: string
  updated_at: string
}

export interface PostVersion {
  id: string
  case_id: string
  version_number: number
  date_captured: string
  uploaded_by_id: string | null
  uploaded_by?: Profile
  change_type: VersionChangeType
  screenshot_url: string | null
  description: string | null
  notes: string | null
  created_at: string
}

export interface Evidence {
  id: string
  case_id: string
  file_url: string
  file_name: string
  file_type: string
  evidence_type: EvidenceType
  description: string | null
  uploaded_by_id: string | null
  uploaded_by?: Profile
  created_at: string
}

export interface Engagement {
  id: string
  case_id: string
  likes: number
  comments: number
  shares: number
  views: number
  reposts: number
  saves: number
  capture_date: string
  created_at: string
}

export interface Narrative {
  id: string
  name: string
  description: string | null
  frequency: number
  trend_direction: 'rising' | 'stable' | 'falling'
  related_case_ids: string[] | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  case_id: string | null
  user_id: string | null
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface ScoringFormula {
  id: string
  name: string
  formula_type: 'claim_seriousness' | 'influence' | 'overall_risk'
  weights: Record<string, number>
  thresholds: Record<string, number>
  is_active: boolean
  updated_by_id: string | null
  updated_at: string
}

export interface AIPrompt {
  id: string
  name: string
  prompt_type: string
  system_prompt: string
  user_prompt_template: string
  is_active: boolean
  updated_by_id: string | null
  updated_at: string
}

export interface DashboardStats {
  total_cases: number
  total_posts: number
  total_comments: number
  red_cases: number
  yellow_cases: number
  blue_cases: number
  grey_cases: number
  total_platforms: number
  total_topics: number
  total_influencers: number
  total_fake_accounts: number
}
