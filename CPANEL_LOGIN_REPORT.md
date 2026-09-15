# HORMAT-code-v4 — CPanel login UI completion report

## Status

The requested CPanel login UI is complete and ready for review at **GET /cpanel/login**. It uses the supplied `Современная страница входа HORMAT MARKET.png` as a design reference only. Generated reference text was not copied literally. No real authentication or unrelated business module was implemented.

## Design and assets

- Full-viewport desktop grid: 55% promotional photography, 45% clean white form area.
- Temporary HORMAT MARKET text/CSS wordmark; no official logo existed in this project.
- Promotional headline, supporting text, three benefits and bottom slogan.
- Top-right language selector, centered email/password form, visibility toggle, green sign-in button, administrator-managed-account notice, and current-year footer.
- Separate CPanel login stylesheet and script; existing Bootstrap, jQuery and Socket.IO retained.
- Locally authored SVG symbols provide consistent icons without dependencies.
- Below 900px, the promotional panel is hidden and the form takes priority. Verified at 320×568, 375×812, 768×1024, 1366×768 and 1536×1024 without horizontal scrolling.

Downloaded image: `src/public/cpanel/images/login/ashgabat.jpg`, 2200×1650 JPEG. **Modern architectural buildings on a cloudy day**, Ashgabat, by **Nikolai Kolosov**, from [Unsplash](https://unsplash.com/photos/modern-architectural-buildings-on-a-cloudy-day-FNInp0-cQ5I). The source identifies it as free under the [Unsplash License](https://unsplash.com/license). It is served locally, with CSS cover cropping and an overlay. Full download/source attribution is preserved in `docs/CPANEL_LOGIN.md`.

Screenshots generated and visually inspected:

- `artifacts/login-tm-desktop.png`
- `artifacts/login-ru-desktop.png`
- `artifacts/login-375.png`

Additional automated screenshots: English desktop, 320px, 768px and 1366px viewports. Artifacts are ignored by Git.

## Localization and database changes

Migration **002_cpanel_login_translations.sql** adds **28 new keys / 84 translation values**. All are complete for **tm, ru and en**. Existing migration 001 is unchanged. No schema, user, permission or authentication tables were added.

Keys:

```text
brand.name
brand.market
cpanel.login.title
cpanel.login.subtitle
cpanel.login.email
cpanel.login.password
cpanel.login.submit
cpanel.login.showPassword
cpanel.login.hidePassword
cpanel.login.language
cpanel.login.changeLanguage
cpanel.login.managedNotice
cpanel.login.rights
cpanel.login.unavailable
cpanel.login.emailRequired
cpanel.login.emailInvalid
cpanel.login.passwordRequired
cpanel.login.javascriptRequired
cpanel.login.promoHeadline
cpanel.login.promoDescription
cpanel.login.featureChoice
cpanel.login.featureChoiceDetail
cpanel.login.featureService
cpanel.login.featureServiceDetail
cpanel.login.featureConvenience
cpanel.login.featureConvenienceDetail
cpanel.login.slogan
cpanel.login.sloganDetail
```

All UI copy uses the shared request-bound EJS `t()` helper. Necessary browser validation/toggle values are safely exposed using escaped data attributes, not a separate localization system. Language display names come from the active registry. Normal `t()` calls remain memory-only.

The selector uses the existing `POST /language` route and `hormat_lang` cookie. `/cpanel/login` was added to the explicit safe redirect allowlist. Selection reloads the login page in the selected language; an explicit submit button supports language switching without JavaScript.

## Form behavior and intentional limitations

The password is hidden by default. The jQuery toggle updates its type, accessible label, icon and pressed state. Required-field and email-format validation use translated feedback and focus the first invalid control.

Submission is intentionally **mock/UI-only**. It is intercepted locally, clears the password, and displays a translated unavailable notice. No login request, credential persistence/logging, session, authentication verification, or dashboard redirect occurs. Controls are disabled until JavaScript handlers are installed, and credential inputs have no names for native form serialization.

No public registration, forgot/reset-password, social/phone login, OTP, magic link, or remember-me control was added. No login POST route exists. Existing `/` and `/cpanel` pages remain unchanged and there are no global authentication redirects.

Architecture section 24 and AGENTS.md record the permanent product rule: administrator-managed CPanel accounts, email + password only, no self-service authentication unless explicitly changed. The same-task translation rule is preserved.

## Files created/modified

Created:

- `src/controllers/cpanel/login.ts`
- `src/views/cpanel/pages/login.ejs`
- `src/views/cpanel/partials/login-icon.ejs`
- `src/views/cpanel/partials/wordmark.ejs`
- `src/public/cpanel/css/login.css`
- `src/public/cpanel/js/login.js`
- `src/public/cpanel/images/login/{ashgabat.jpg,icons.svg}`
- `src/database/migrations/002_cpanel_login_translations.sql`
- `tests/login.spec.ts`
- `docs/CPANEL_LOGIN.md`
- `CPANEL_LOGIN_REPORT.md`

Modified:

- `src/routes/cpanel/index.ts`
- `src/localization/http.ts`
- `tests/unit/database.test.ts` (updated complete seed/migration counts)
- `.gitignore` (generated screenshots)
- `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/LOCALIZATION.md`

No new npm dependencies were required.

## Executed verification

- `npm run db:migrate`: passed; migration 002 applied to the configured local development database.
- `npm run build`: passed, including login templates/styles/scripts/SVG/photo and migration SQL in dist.
- `npm run typecheck`: passed.
- `CHROME_PATH=/usr/bin/google-chrome npm test`: **11 service/database tests + 19 browser/HTTP tests passed**.
- `TEST_PRODUCTION=1 CHROME_PATH=/usr/bin/google-chrome npm test`: **11 service/database tests + 19 browser/HTTP tests passed**.
- All prior foundation/localization regression tests passed in both modes, including Bootstrap behavior, jQuery, Socket.IO, health, cookies and fallback.
- New login checks passed for HTTP 200, local assets, all three languages, layout proportions, responsive widths, language switching, password visibility, localized validation, no credential POST/storage, and JavaScript-disabled fallback.
- Source check: all 28 keys have three nonblank translations; direct template keys exist; login EJS contains no literal visible words outside translations/dynamic data.
- Compiled migration and photograph matched their source files.
- Desktop and mobile screenshots were visually inspected.

An initial no-JavaScript test asserted the text of the `noscript` wrapper rather than its rendered paragraph. The visible notice was correct; the locator was corrected and all final tests passed. Image download needed approved network access. Existing terminal-color warnings and intentional oversized-request regression logs do not indicate failures.

## Remaining issues

No known UI or regression issues remain. Real authentication is intentionally unimplemented and awaits the Users/Permissions stage. The wordmark is temporary. The existing local PostgreSQL configuration remains in use. No next module was started; work stopped at this login UI.
