set local lock_timeout = '3s';
set local statement_timeout = '15s';

alter table public.profiles
  drop constraint profiles_preferred_language_check,
  add constraint profiles_preferred_language_check
    check (preferred_language in ('en', 'ko', 'ja', 'zh-CN', 'uz', 'vi', 'mn', 'ms'));

alter table public.guest_profiles
  drop constraint guest_profiles_locale_check,
  add constraint guest_profiles_locale_check
    check (locale in ('en', 'ko', 'ja', 'zh-CN', 'uz', 'vi', 'mn', 'ms'));
