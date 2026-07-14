-- Session turnover metadata: the code students typed to join (the sync
-- channel name). Usually equals the 4-char part of `id`; differs when the
-- code was reused across back-to-back runs ("Run next student").
alter table public.sessions add column if not exists session_code text;
