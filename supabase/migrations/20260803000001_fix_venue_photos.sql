-- Chicago Shakespeare Theater: og:image is a 192x192 favicon, not a real venue photo
-- Writers Theatre: og:image URL returns content-length: 0 (broken)
-- Null both so the dark placeholder shows instead of broken/tiny images
UPDATE venues SET
  photo_url = NULL,
  photo_url_source = NULL
WHERE slug IN ('chicago-shakespeare', 'writers-theatre')
  AND photo_url_source = 'og_image';
