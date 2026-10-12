# Phase 7 — Public Information Site and SEO

> Status: **Implemented and verified.**
> The administrative portal stays private and non-indexed; a separate public
> surface carries only approved-for-publication content — which, currently, is
> placeholder text.

---

## 1. Separation from the administrative portal

The public site lives under **`/info`** and is deliberately separate:

- It renders **without the administrative shell**. `AppShell` returns its
  children directly for `/info` paths, so anonymous visitors never receive the
  internal navigation, the sidebar or the sign-out control.
- It uses its own stylesheet (`src/styles/public.css`) and its own frame
  (`src/components/public/PublicShell.tsx`).
- It links to nothing behind authentication except a plain "restricted
  sign-in" link to `/login`.
- It reuses the mandated design tokens and the **global geometric background**
  (`#1d1d1d`, `#4e4f51`, `#3c3c3c`), which is applied by the root layout and was
  not modified.

## 2. Pages

| Path | Content |
|---|---|
| `/info` | Hub: what the prototype is, what it is not, links to the sections |
| `/info/guidance` | Provisional passenger guidance (explicitly non-authoritative) |
| `/info/permits` | How the prototype *records* permits, and that it verifies nothing |
| `/info/notices` | Honest empty state — no notice has been approved for publication |
| `/info/faqs` | Six provisional Q&A entries |
| `/info/contact` | Contact details marked "To be confirmed" — nothing invented |

Every page carries a visible banner stating that this is an unofficial
development prototype. No postal address, telephone number, email address,
fee, deadline, form or legal rule was invented anywhere.

## 3. Technical SEO

- **Metadata.** `src/app/info/layout.tsx` sets `metadataBase` from
  `NEXT_PUBLIC_APP_URL` and `robots: { index: true, follow: true }`, overriding
  the root layout's global `noindex`. Each page supplies its own title,
  description and `alternates.canonical`.
- **`/robots.txt`** (`src/app/robots.ts`): allows `/info`, disallows `/`, `/api/`
  and every authenticated area (`/operators`, `/vehicles`, `/routes`,
  `/permits`, `/trips`, `/inspections`, `/incidents`, `/reports`, `/audit`,
  `/settings`, `/login`, `/forbidden`), and declares the sitemap.
- **`/sitemap.xml`** (`src/app/sitemap.ts`): lists **only** the six public pages.
  The admin area, APIs and authenticated pages are excluded — listing them would
  advertise private endpoints.
- **Structured data:** no JSON-LD was added. Any `Organization`/`WebSite` markup
  would require an approved official name, URL and contact point, none of which
  exists. Omitting it is the accurate choice.
- **Semantic HTML:** one `<h1>` per page, real landmarks, `<dl>` for
  question/answer pairs, and links that work without JavaScript.

## 4. Why robots rules are not the security control

Crawler directives are a politeness signal. The real protection for the admin
portal is that every page, server action and route handler requires a verified
session, and unauthenticated requests are redirected (pages) or rejected
(APIs). The smoke test asserts both.

## 5. Verification evidence

`npm run verify:pages` — **56/56 live checks passed**, including:

| Check | Result |
|---|---|
| All six `/info` pages anonymous | 200 |
| Public pages contain the unofficial-prototype banner | Yes |
| Public pages are **not** wrapped in the admin shell | `app-sidebar` absent |
| `robots.txt` | 200, `Allow: /info`, `Disallow: /` |
| `sitemap.xml` | 200, contains `/info`, does **not** contain `/operators` |
| Build output | `/info/*`, `/robots.txt` and `/sitemap.xml` are statically prerendered (`○`) |

Static prerendering of the public pages is the desired outcome for SEO and for
load time on a modest Windows machine.

## 6. Content strategy and keyword research — not performed

An earlier scope note mentioned keyword research and a content strategy. That
was **not** done, and no SEO outcome is claimed. Publishing keyword-optimised
government content before the department has approved the official wording,
authority and domain would be premature and potentially misleading. The
technical foundation (titles, descriptions, canonicals, sitemap, robots) is in
place so approved content can be added without rework.

## 7. Pending departmental decisions

- The public domain, official department name and approved contact details.
- Which notices, procedures and guidance may be published, and who approves them.
- Urdu/English content and RTL presentation for the public site.
