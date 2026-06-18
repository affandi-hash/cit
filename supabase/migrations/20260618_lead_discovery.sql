-- Lead Discovery / Deep Search Module

-- Configurable search entities (e.g. "Coach Fadzil", "QM", "Samurai Yakiniku")
create table if not exists lead_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] default '{}',
  description text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Configurable allegation keywords (e.g. "ponzi", "tipu", "scam")
create table if not exists lead_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  category text,
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Each "Pull Leads" run
create table if not exists lead_batches (
  id uuid primary key default gen_random_uuid(),
  run_by_id uuid references profiles(id),
  query_count int default 0,
  lead_count int default 0,
  status text default 'completed',
  queries_used jsonb default '[]',
  created_at timestamptz default now()
);

-- Individual leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text unique,
  batch_id uuid references lead_batches(id) on delete set null,
  platform text,
  url text,
  author text,
  title text,
  snippet text,
  matched_entity text,
  matched_keyword text,
  narrative text,
  ai_priority text default 'medium',   -- high / medium / low
  ai_notes text,
  date_found timestamptz default now(),
  published_date text,
  status text default 'new',            -- new / opened / useful / not_relevant / duplicate / saved_to_case / needs_screenshot / legal_review
  duplicate_of_id uuid references leads(id),
  converted_case_id uuid references cases(id),
  reviewed_by_id uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-generate lead_number
create or replace function generate_lead_number()
returns trigger language plpgsql as $$
declare
  seq int;
begin
  select count(*) + 1 into seq from leads;
  new.lead_number := 'LD-' || lpad(seq::text, 6, '0');
  return new;
end;
$$;

create trigger trg_lead_number
  before insert on leads
  for each row when (new.lead_number is null)
  execute function generate_lead_number();

-- Indexes
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_batch_id on leads(batch_id);
create index if not exists idx_leads_created_at on leads(created_at desc);

-- Seed some default entities and keywords (can be changed in admin)
insert into lead_entities (name, description, sort_order) values
  ('Coach Fadzil', 'Primary subject', 1),
  ('QM', 'QM investment scheme', 2)
on conflict do nothing;

insert into lead_keywords (keyword, category, sort_order) values
  ('ponzi', 'fraud', 1),
  ('scam', 'fraud', 2),
  ('tipu', 'fraud', 3),
  ('MLM', 'scheme', 4),
  ('skim cepat kaya', 'scheme', 5),
  ('penipuan', 'fraud', 6)
on conflict do nothing;
