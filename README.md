# 営業道場 — AimHigh 携帯販売営業ロープレ研修ツール

AIがお客さんを演じる携帯販売スタッフ向け研修ツールです。  
ロープレ終了後にルーブリックで自動採点、管理者は全スタッフの成績を閲覧できます。

## 機能

- **11種のシナリオ** (きほん / MNP特化 / 新規特化 / コンプラ・トラブル)
- **客役AI** — `claude-sonnet-4-6` が警戒度を持つリアルな客を演じる
- **自動採点** — 100点満点のルーブリックで忖度なし採点
- **反論機能** — 論理的な反論には点数が動く
- **管理者ダッシュボード** — 全スタッフの成績・会話ログ・採点詳細を閲覧

## セットアップ

### 1. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、各値を入力：

```bash
cp .env.example .env.local
```

| 変数 | 説明 |
|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API キー |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `ADMIN_PASSWORD` | 管理者ページのパスワード |

### 2. Supabase テーブル作成

Supabase の SQL Editor で以下を実行：

```sql
create table public.roleplay_results (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  scenario_id text not null,
  scenario_label text not null,
  category text not null,
  is_random boolean not null default false,
  score integer not null check (score >= 0 and score <= 100),
  highlights jsonb not null default '[]',
  deductions jsonb not null default '[]',
  summary text not null default '',
  transcript jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- anon ユーザーに読み書き許可
alter table public.roleplay_results enable row level security;

create policy "allow_insert" on public.roleplay_results
  for insert to anon with check (true);

create policy "allow_select" on public.roleplay_results
  for select to anon using (true);

create policy "allow_update" on public.roleplay_results
  for update to anon using (true);
```

### 3. ローカル起動

```bash
npm install
npm run dev
```

## Vercel デプロイ手順

1. [Vercel](https://vercel.com/) にサインイン
2. 「New Project」→ このリポジトリをインポート
3. **Environment Variables** に以下を追加：
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
4. 「Deploy」をクリック

## ページ構成

| URL | 説明 |
|-----|------|
| `/` | ロープレ本体 (スタッフ用) |
| `/admin` | 管理者ダッシュボード (パスワード認証) |

## 技術スタック

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Anthropic API** — claude-sonnet-4-6
- **Supabase** — PostgreSQL
- **Vercel** — ホスティング

## セキュリティ

- `ANTHROPIC_API_KEY` はサーバーサイドのみで使用（クライアントに露出しない）
- AI 呼び出しはすべて `/api/roleplay` Route Handler 経由
- Zod による入力バリデーション
- IP ベースの簡易レート制限（60秒で最大20リクエスト）
- max_tokens: 1024 に制限、15往復で強制採点
