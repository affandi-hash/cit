-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

-- Keyword Groups
CREATE TABLE keyword_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'BLUE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keywords
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES keyword_groups(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  severity_score INTEGER NOT NULL DEFAULT 50 CHECK (severity_score BETWEEN 0 AND 100),
  color_tag TEXT NOT NULL DEFAULT 'YELLOW',
  reputation_impact TEXT NOT NULL DEFAULT 'Medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_legal_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX keywords_keyword_idx ON keywords(LOWER(keyword));

-- Detected Keywords per Case
CREATE TABLE detected_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  frequency INTEGER NOT NULL DEFAULT 1,
  first_appearance TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_appearance TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_id, keyword_id)
);

-- Add heat score columns to cases
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS keyword_heat_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reputation_impact_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legal_review_recommended BOOLEAN DEFAULT false;

-- Triggers
CREATE TRIGGER update_keyword_groups_updated_at BEFORE UPDATE ON keyword_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keyword_groups_read" ON keyword_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "keyword_groups_write" ON keyword_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')));

CREATE POLICY "keywords_read" ON keywords FOR SELECT TO authenticated USING (true);
CREATE POLICY "keywords_write" ON keywords FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin')));

CREATE POLICY "detected_keywords_read" ON detected_keywords FOR SELECT TO authenticated USING (true);
CREATE POLICY "detected_keywords_write" ON detected_keywords FOR ALL TO authenticated USING (true);

-- Default keyword groups + keywords
INSERT INTO keyword_groups (name, description, color, sort_order) VALUES
  ('Scam Related', 'Fraud, scam, and deception keywords', 'RED', 1),
  ('Financial', 'Financial disputes, salary, debt keywords', 'YELLOW', 2),
  ('Business', 'Business disputes, contracts, licensing', 'YELLOW', 3),
  ('Reputation', 'Personal reputation attack keywords', 'RED', 4),
  ('Legal', 'Legal accusations and criminal allegations', 'RED', 5),
  ('Sentiment', 'General negative sentiment indicators', 'BLUE', 6);

-- Scam Related keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('scam', 95, 'RED', 'Critical', true),
  ('scammer', 95, 'RED', 'Critical', true),
  ('penipu', 95, 'RED', 'Critical', true),
  ('fraud', 90, 'RED', 'Critical', true),
  ('fraudulent', 90, 'RED', 'Critical', true),
  ('tipu', 85, 'RED', 'Critical', true),
  ('menipu', 85, 'RED', 'Critical', true),
  ('ponzi', 95, 'RED', 'Critical', true),
  ('pyramid scheme', 90, 'RED', 'Critical', true),
  ('investment scam', 95, 'RED', 'Critical', true),
  ('skim cepat kaya', 80, 'RED', 'Critical', true)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Scam Related';

-- Financial keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('unpaid salary', 75, 'RED', 'High', false),
  ('hutang', 60, 'YELLOW', 'Medium', false),
  ('debt', 55, 'YELLOW', 'Medium', false),
  ('bankruptcy', 80, 'RED', 'High', false),
  ('insolvency', 80, 'RED', 'High', false),
  ('EPF', 50, 'YELLOW', 'Medium', false),
  ('KWSP', 50, 'YELLOW', 'Medium', false),
  ('salary', 40, 'BLUE', 'Low', false),
  ('payroll', 40, 'BLUE', 'Low', false),
  ('payment delay', 60, 'YELLOW', 'Medium', false)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Financial';

-- Business keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('supplier', 30, 'BLUE', 'Low', false),
  ('contractor', 30, 'BLUE', 'Low', false),
  ('franchise', 35, 'BLUE', 'Low', false),
  ('licensing', 35, 'BLUE', 'Low', false),
  ('royalty', 40, 'BLUE', 'Low', false),
  ('breach of contract', 75, 'RED', 'High', false)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Business';

-- Reputation keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('liar', 80, 'RED', 'High', false),
  ('dishonest', 75, 'RED', 'High', false),
  ('unethical', 70, 'YELLOW', 'High', false),
  ('corrupt', 90, 'RED', 'Critical', true),
  ('corruption', 90, 'RED', 'Critical', true),
  ('cheating', 75, 'RED', 'High', false),
  ('fake certificate', 90, 'RED', 'Critical', true),
  ('fake license', 90, 'RED', 'Critical', true),
  ('penipuan', 90, 'RED', 'Critical', true),
  ('bohong', 70, 'YELLOW', 'High', false)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Reputation';

-- Legal keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('criminal', 90, 'RED', 'Critical', true),
  ('theft', 85, 'RED', 'Critical', true),
  ('curi', 85, 'RED', 'Critical', true),
  ('blackmail', 90, 'RED', 'Critical', true),
  ('harassment', 80, 'RED', 'High', true),
  ('defamation', 75, 'RED', 'High', true),
  ('lawsuit', 70, 'YELLOW', 'High', false),
  ('court case', 70, 'YELLOW', 'High', false),
  ('police report', 75, 'RED', 'High', false),
  ('laporan polis', 75, 'RED', 'High', false)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Legal';

-- Sentiment keywords
INSERT INTO keywords (group_id, keyword, severity_score, color_tag, reputation_impact, is_legal_flag)
SELECT g.id, k.keyword, k.sev, k.color, k.impact, k.legal
FROM keyword_groups g,
(VALUES
  ('refund', 50, 'YELLOW', 'Medium', false),
  ('complaint', 45, 'YELLOW', 'Medium', false),
  ('aduan', 45, 'YELLOW', 'Medium', false),
  ('warning', 40, 'YELLOW', 'Medium', false),
  ('amaran', 40, 'YELLOW', 'Medium', false),
  ('avoid', 35, 'BLUE', 'Low', false),
  ('beware', 55, 'YELLOW', 'Medium', false),
  ('berhati-hati', 55, 'YELLOW', 'Medium', false),
  ('opinion', 15, 'BLUE', 'Low', false),
  ('review', 20, 'BLUE', 'Low', false)
) AS k(keyword, sev, color, impact, legal)
WHERE g.name = 'Sentiment';
