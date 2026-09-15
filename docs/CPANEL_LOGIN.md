# CPanel login UI

> Historical UI-stage specification. Real login, secure sessions, protected `/cpanel`, logout and current tests now follow [CPANEL_AUTH.md](CPANEL_AUTH.md); mock-submission statements below describe the earlier stage only.

## Scope and reference

`GET /cpanel/login` is a standalone EJS login screen. The supplied **Современная страница входа HORMAT MARKET.png** was used only for visual direction: a full-height photo/branding panel and a clean form panel. Text was written for the shared translation system, not transcribed from the generated reference. No official logo existed in the project, so a temporary text/CSS wordmark is used.

The desktop layout is 55% promotional image and 45% form. It includes a marketplace headline, short description, three benefit items, a bottom slogan, top-right language selector, email/password form, visibility toggle, administrator-account notice and current-year footer. It has no dashboard navigation. Dedicated CPanel CSS controls spacing and responsive behavior; Bootstrap handles core form/button conventions. Below 900px the photo panel is hidden and the form occupies the page. Short screens scroll vertically; inputs remain comfortable on 320px-wide screens.

## Image provenance

- Local asset: `src/public/cpanel/images/login/ashgabat.jpg` (2200 × 1650 JPEG).
- Photograph: **Modern architectural buildings on a cloudy day**, Ashgabat, Turkmenistan.
- Photographer: **Nikolai Kolosov** (`nikolaikolosov`).
- Source: https://unsplash.com/photos/modern-architectural-buildings-on-a-cloudy-day-FNInp0-cQ5I
- Download URL: https://images.unsplash.com/photo-1764505878737-ec5a63a38982?auto=format&fit=crop&fm=jpg&q=85&w=2200
- Downloaded 2026-09-15. Source identifies it as free to use under the [Unsplash License](https://unsplash.com/license).
- The downloaded JPEG is served locally. Display cropping and a readability overlay use CSS; the photo is not hotlinked or baked into the reference image. The original source identifies its author and license; this record preserves that attribution.

Icons are a small, locally authored SVG symbol sheet (`icons.svg`) with consistent strokes. No icon framework, third-party logo, font service, CDN, or new npm dependency was added.

## Localization

Migration `002_cpanel_login_translations.sql` adds **28 keys / 84 values**, complete for `tm`, `ru`, `en`. It changes translation data only; no tables or authentication schema are added. Apply migrations and restart/reload the localization cache before serving the new page.

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

EJS uses the existing request-bound `t()`. Only required translated validation/toggle strings are exposed to JavaScript through escaped `data-*` attributes. Visible notices are rendered server-side and revealed as needed. There is no separate browser translation system. Language names come from the active-language database registry; the copyright year is generated server-side.

The selector posts to the existing `/language` route. Its exact safe return-target allowlist now includes `/cpanel/login`. The existing `hormat_lang` cookie controls the page and retains its original path, lifetime and security flags. Selection automatically submits with JavaScript; without JavaScript an explicit translated language button still works.

## Mock form behavior

Email uses `type=email` and `autocomplete=username`; password uses `type=password` and `autocomplete=current-password`. Labels are associated with controls. A jQuery handler toggles visibility, accessible button text and `aria-pressed`. Validation uses localized messages linked to the inputs, marks invalid controls, and focuses the first invalid field.

A valid submit is intercepted locally, clears the password, and displays a translated sign-in-unavailable notice. It does **not** make a login request, persist/log credentials, create sessions, authenticate anyone, or navigate to a dashboard. Inputs intentionally have no `name` attributes, so they are not serialized into a fallback form request. The submit and visibility controls stay disabled until their handlers are installed; without JavaScript a translated notice explains the requirement.

No login POST route or authentication storage exists. `/` and `/cpanel` remain unchanged, with no new global authentication redirects. The administrator-managed/email-and-password-only product rule is recorded in architecture section 24.

## Verification and screenshots

`tests/login.spec.ts` adds nine browser tests: desktop `tm`/`ru`/`en`, selector/toggle/validation/mock submit, four responsive viewport cases, and no-JavaScript fallback. It checks route/assets, layout proportions, absence of unresolved keys, Bootstrap/jQuery availability, Socket.IO, no credential POST/storage, and language-cookie behavior. The database suite verifies all 34 total translation keys have three values and migrations remain repeatable.

Screenshots are generated under ignored `artifacts/`, including `login-tm-desktop.png`, `login-ru-desktop.png`, `login-en-desktop.png`, `login-375.png`, `login-768.png`, `login-320.png`, and `login-1366.png`. See `CPANEL_LOGIN_REPORT.md` at the project root for executed check results.
