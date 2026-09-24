-- Custom migration: seed the five formatting templates. Without them the
-- preview page offers nothing to pick and export can never get a valid
-- template_id. `genre` names a CSS file in services/converter/templates/ and
-- must be in the converter's VALID_TEMPLATES list; keep the two in sync.
insert into templates (name, genre, css_url, description)
values
  ('Literary', 'literary',
   'services/converter/templates/literary.css',
   'Restrained serif setting with generous margins, for literary and upmarket fiction.'),
  ('Romance', 'romance',
   'services/converter/templates/romance.css',
   'Warm, softly spaced setting with decorative chapter openers.'),
  ('Thriller', 'thriller',
   'services/converter/templates/thriller.css',
   'Tight, high-contrast setting that keeps the page turning.'),
  ('Fantasy', 'fantasy',
   'services/converter/templates/fantasy.css',
   'Classical setting with ornamented chapter headings, for epic and secondary-world fiction.'),
  ('Science Fiction', 'scifi',
   'services/converter/templates/scifi.css',
   'Clean, modern setting with a technical feel.')
on conflict (genre) do nothing;
