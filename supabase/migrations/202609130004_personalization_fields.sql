alter table public.profiles
  add column if not exists arrival_phase text check (arrival_phase is null or arrival_phase in ('before-arrival','already-arrived')),
  add column if not exists study_track text check (study_track is null or study_track in ('exchange','degree')),
  add column if not exists departure_date date;
