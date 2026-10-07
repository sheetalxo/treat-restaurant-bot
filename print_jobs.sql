-- Run once in Supabase -> SQL Editor
create table if not exists print_jobs (
  id          bigint generated always as identity primary key,
  order_id    text not null,
  kind        text not null default 'kot',      -- 'kot' | 'bill'
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',  -- pending | claimed | printed | failed
  claimed_by  text,
  claimed_at  timestamptz,
  printed_at  timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists print_jobs_status_created_idx on print_jobs (status, created_at);
alter table print_jobs enable row level security; -- service key bypasses RLS; keeps anon key out
