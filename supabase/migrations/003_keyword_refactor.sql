-- Add keyword_type and separate score columns to keywords
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS keyword_type TEXT NOT NULL DEFAULT 'Custom';
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS seriousness_score INTEGER DEFAULT 0;
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0;

-- Map existing keywords to types based on their group
UPDATE keywords SET keyword_type = 'Allegation', seriousness_score = severity_score
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Scam Related');

UPDATE keywords SET keyword_type = 'Financial', seriousness_score = severity_score
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Financial');

UPDATE keywords SET keyword_type = 'Business Dispute', seriousness_score = severity_score
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Business');

UPDATE keywords SET keyword_type = 'Reputation Attack', reputation_score = severity_score
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Reputation');

UPDATE keywords SET keyword_type = 'Legal', seriousness_score = severity_score
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Legal');

UPDATE keywords SET keyword_type = 'Neutral Context', seriousness_score = 0, reputation_score = 0
  WHERE group_id IN (SELECT id FROM keyword_groups WHERE name = 'Sentiment');

-- Entity keyword group
INSERT INTO keyword_groups (name, description, color, sort_order)
VALUES ('Entity', 'Named people, companies, and brands — identifiers only, no seriousness score', 'GREY', 0)
ON CONFLICT DO NOTHING;

-- Seed Entity keywords
INSERT INTO keywords (group_id, keyword, keyword_type, severity_score, seriousness_score, reputation_score, color_tag, reputation_impact, is_active, is_legal_flag)
SELECT g.id, kw, 'Entity', 0, 0, 0, 'GREY', 'Low', true, false
FROM keyword_groups g,
UNNEST(ARRAY['coach fadzil','brainy bunch','malakat','tea amo','quantum metal','qm','dre coffee','eastel','lhdn']) AS kw
WHERE g.name = 'Entity'
ON CONFLICT (LOWER(keyword)) DO UPDATE SET keyword_type = 'Entity', seriousness_score = 0, reputation_score = 0, severity_score = 0;

-- EPF and KWSP already exist — update them to Entity type
UPDATE keywords SET keyword_type = 'Entity', seriousness_score = 0, reputation_score = 0, severity_score = 0, color_tag = 'GREY', is_legal_flag = false
  WHERE LOWER(keyword) IN ('epf', 'kwsp');

-- case_scores: one row per case, all dimension scores
CREATE TABLE IF NOT EXISTS case_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  claim_seriousness_score INTEGER DEFAULT 0,
  reputation_impact_score INTEGER DEFAULT 0,
  influence_score INTEGER DEFAULT 0,
  evidence_strength_score INTEGER DEFAULT 0,
  narrative_amplification_score INTEGER DEFAULT 0,
  legal_exposure_score INTEGER DEFAULT 0,
  overall_priority_score INTEGER DEFAULT 0,
  priority_colour TEXT DEFAULT 'BLUE',
  legal_review_status TEXT DEFAULT 'Not Required',
  score_explanation TEXT,
  detected_entities JSONB DEFAULT '[]',
  detected_harmful JSONB DEFAULT '[]',
  human_confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id)
);

-- case_keyword_matches: replaces detected_keywords with richer data
CREATE TABLE IF NOT EXISTS case_keyword_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  matched_text TEXT,
  frequency INTEGER NOT NULL DEFAULT 1,
  context_excerpt TEXT,
  detected_from TEXT DEFAULT 'ai_evaluation',
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, keyword_id)
);

-- Score weights (admin editable)
CREATE TABLE IF NOT EXISTS score_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Formula',
  claim_seriousness_weight NUMERIC DEFAULT 0.25,
  reputation_impact_weight NUMERIC DEFAULT 0.20,
  influence_weight NUMERIC DEFAULT 0.20,
  evidence_strength_weight NUMERIC DEFAULT 0.15,
  narrative_amplification_weight NUMERIC DEFAULT 0.10,
  legal_exposure_weight NUMERIC DEFAULT 0.10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO score_weights (name) VALUES ('Default Formula');

-- Colour thresholds (admin editable)
CREATE TABLE IF NOT EXISTS colour_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  colour_code TEXT NOT NULL,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  badge_text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO colour_thresholds (label, colour_code, min_score, max_score, badge_text, sort_order) VALUES
  ('Critical', 'DARK_RED', 90, 100, 'Critical', 1),
  ('High',     'RED',      75,  89, 'High',     2),
  ('Serious',  'ORANGE',   50,  74, 'Serious',  3),
  ('Monitor',  'YELLOW',   25,  49, 'Monitor',  4),
  ('Low',      'BLUE',      0,  24, 'Low',      5);

-- Triggers
CREATE TRIGGER update_case_scores_updated_at BEFORE UPDATE ON case_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE case_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_keyword_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE colour_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_scores_read" ON case_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "case_scores_write" ON case_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "case_keyword_matches_read" ON case_keyword_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "case_keyword_matches_write" ON case_keyword_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "score_weights_read" ON score_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "score_weights_write" ON score_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "colour_thresholds_read" ON colour_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "colour_thresholds_write" ON colour_thresholds FOR ALL TO authenticated USING (true) WITH CHECK (true);
