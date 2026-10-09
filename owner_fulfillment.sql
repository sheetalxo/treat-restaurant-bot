-- Run ONCE in Supabase -> SQL Editor (safe to re-run)
alter table orders add column if not exists fulfillment text not null default 'NEW';
alter table orders drop constraint if exists orders_fulfillment_check;
alter table orders add constraint orders_fulfillment_check
  check (fulfillment in ('NEW','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','COMPLETED','REJECTED'));
