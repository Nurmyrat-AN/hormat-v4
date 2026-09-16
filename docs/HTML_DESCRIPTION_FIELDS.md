# Reusable HTML Description fields

Formatted customer-facing Description fields use one lightweight HtmlEditor with bold, italic, underline, ordered/unordered lists, safe links, clear formatting and natural paragraphs/newlines. It adapts existing textarea values/events rather than changing dialog/save scopes. Base and all inline-language Description editors reuse the same component; no Translations tab exists.

Current opt-in: Payment Types, Delivery Types and Order Statuses. These are the actual description fields found in current reference/content schemas. Name, Slug, SEO Title/Description and ordinary short fields remain plain text.

## Server boundary

`src/content/html.ts` centrally uses sanitize-html before Description persistence and on existing-record presentation. Allowlist: p, br, strong/b, em/i, u, ul, ol, li, a, div, span, h1–h6, img, table/thead/tbody/tr/th/td and blockquote. Links allow href/title and _self/_blank targets (the latter forces noopener noreferrer), http/https/mailto and safe relative URLs. Images allow http/https and relative sources, alt/title/width/height. Protocol-relative, data, javascript and vbscript image URLs are disabled. Class and validated style are allowed; cells allow colspan/rowspan. Event handlers, unsupported attributes and active script/style/iframe/object/embed/svg/math content are removed. Browser toolbar is not a security boundary. Browser paste inserts plain text and drops are blocked.

Current PostgreSQL text columns remain unchanged, with the existing 4,000-character persisted limit including HTML. Legacy plain text is safely escaped and line breaks preserved for editing; no destructive data migration. Saving normalizes into allowed HTML. Existing unsanitized database text is never blindly rendered as HTML.

Grid/List previews convert sanitized HTML to readable text, normalize whitespace and truncate at 240 characters. Translation fallback remains base Description when the requested override is absent; an empty formatted override is removed. Inline fallback helper also shows readable text. Formatting affects Description only; independent field save states, footer, permissions and other controls remain intact.

## Verification

Four focused server tests cover the central allowlist and actual base/translated persistence in all three modules, including legacy text, unsafe tags/events/URLs and fallback. One browser scenario covers toolbar operations, lists, links, clearing, translated paragraphs, save/reload, safe character handling and Grid/List previews. Two fresh-migration localization tests cover the nine new toolbar keys (27 tm/ru/en values). Live localization checks run against the actual server. No unrelated historical regression is required.

## Manual HTML amendment

Every opted-in base/translated Description editor has Visual / HTML modes sharing the same textarea value and existing dirty/save scope. HTML mode exposes source in a code-style textarea. Switching to Visual sends an authenticated, CSRF-protected, bounded POST /cpanel/api/html-preview; the same server sanitizer returns HTML without database mutation. Only that cleaned response is inserted into the Visual surface. Failed/stale preview requests retain source mode and drafts. Switching modes alone does not normalize or save the raw draft; saving remains authoritative. Subsequent visual edits use the sanitized representation.

CSS uses sanitize-html's parser with property/value allowlists: text-align, font-weight/style, text-decoration, positive margin/padding (including sides), width/max-width/height/max-height and block/inline/inline-block/none display. Numeric lengths support bounded px/em/rem/% values and zero, dimensions may use auto. No URL CSS, expression, variables, positioning, transforms, negative offsets or arbitrary properties. Safe-property !important may be retained by the parser. Visual content uses layout/paint containment and scrolling so class-based layout cannot escape its editor surface; future HTML presentation containers must retain an equivalent boundary.

Image-only HTML is valid content. No Media upload integration was added. Existing 4,000-character HTML storage limit remains. Migration 066 adds Visual, HTML and preview-failure interface values in tm/ru/en. Five focused server tests, two fresh-localization migration tests and the extended browser scenario pass (8 total); no unrelated historical regression.
