alter table public.policy_records
  drop constraint if exists policy_records_follow_up_check;

alter table public.policy_records
  add constraint policy_records_follow_up_check
  check (follow_up in ('pending', 'contacted', 'interested', 'renewed', 'lost'));
