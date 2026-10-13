-- ============================================================
-- Migration 030: поток 'main' в enum ad_flow
--
-- brief.config.ts описывает единственный поток 'main', а enum ad_flow знал только
-- 'com' и 'gov' → meta/sync падал с "invalid input value for enum ad_flow".
-- ============================================================

alter type ad_flow add value if not exists 'main';
