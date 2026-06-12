-- 営業道場 ロープレ結果テーブル
create table if not exists public.roleplay_results (
  id          uuid        primary key default gen_random_uuid(),
  staff_name  text        not null,
  scenario_id text        not null,
  scenario_label text     not null,
  category    text        not null,
  is_random   boolean     not null default false,
  score       integer     not null check (score >= 0 and score <= 100),
  highlights  jsonb       not null default '[]'::jsonb,
  deductions  jsonb       not null default '[]'::jsonb,
  summary     text        not null default '',
  transcript  jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- インデックス (スタッフ名・日付で絞り込むクエリを高速化)
create index if not exists idx_roleplay_results_staff_name
  on public.roleplay_results (staff_name);
create index if not exists idx_roleplay_results_created_at
  on public.roleplay_results (created_at desc);

-- RLS 有効化
alter table public.roleplay_results enable row level security;

-- anon / authenticated ロールからのアクセスを完全禁止
-- (アクセスはすべて service_role キーを持つサーバーAPIルート経由)
-- service_role は RLS をバイパスするため、ポリシー不要
