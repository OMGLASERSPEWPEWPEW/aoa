-- Wipe all class/school data for clean re-crawl verification of v4.2 fixes
TRUNCATE class_sessions, class_teachers, crawl_state, schools CASCADE;
UPDATE venues SET class_scraped_at = NULL WHERE venue_type = 'school';
