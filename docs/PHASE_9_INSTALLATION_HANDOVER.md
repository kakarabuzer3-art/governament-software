# Phase 9 — Windows Installation, Operation and Handover

> Audience: the developer/administrator who will run this prototype on a
> Windows 10 machine with XAMPP. Every step below was used in this workspace.
>
> **This is an unapproved development prototype.** Do not connect it to
> production government systems, do not load real passenger data, and do not
> publish it as an official service.

---

## 1. Prerequisites

| Component | Required | How to check |
|---|---|---|
| Node.js | 20.9 or newer (verified on 24.19.0) | `node --version` |
| npm | Ships with Node.js (verified with 11.17.0) | `npm --version` |
| XAMPP | Any recent build with MariaDB (this project used XAMPP at `D:\XAMP`) | XAMPP Control Panel opens |
| Git | Optional, for version control | `git --version` |

The project lives in the working folder you were given (this repository root).
All commands below run **in that folder** in PowerShell.

---

## 2. Start MariaDB

1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL**.
3. Wait for the row to show **Running**.
4. Confirm the port: **Config** → `my.ini` → look for `port=`. The default is
   **3306**, which is what `.env` expects.

Quick check from PowerShell:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 3306
# TcpTestSucceeded should be True
```

---

## 3. Create the database and the application user

**Never give the application the `root` account.** Use the least-privilege
script in this repository: `db/setup-db.sql`.

### Option A — phpMyAdmin (easiest)

1. Open <http://localhost/phpmyadmin>.
2. Open `db/setup-db.sql`, replace `CHANGE_THIS_STRONG_PASSWORD` with a strong
   password **you** choose, and copy the whole file.
3. Paste it into the **SQL** tab and click **Go**.

### Option B — command line (as root)

```powershell
D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306
```

Then paste the same statements. This creates:

- database `bpta_transport_dev` (`IF NOT EXISTS` — re-running is safe),
- user `bpta_app` for **both** `127.0.0.1` and `localhost`,
- privileges **only** on `bpta_transport_dev`, never globally.

---

## 4. Configure `.env` safely

Copy the template and fill it in. **`.env` is git-ignored — never commit it and
never paste its contents into a chat or issue.**

```powershell
Copy-Item .env.example .env
notepad .env
```

| Variable | What to put there |
|---|---|
| `DATABASE_URL` | `mysql://bpta_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3306/bpta_transport_dev` |
| `BETTER_AUTH_SECRET` | A long random string (generate below) |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (use the real HTTPS URL in production) |
| `FIELD_ENCRYPTION_KEY` | A 32-byte key — **required** for the passenger manifest |
| `MANIFEST_RETENTION_DAYS` | `10` (the minimum; automatic deletion is off regardless) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | The development administrator to create |
| `SEED_DEMO_DATA` | `true` to also create synthetic demo records |

**If your database password contains special characters** (`/ ? # @ : %`), it
must be URL-encoded inside `DATABASE_URL`:

```powershell
[uri]::EscapeDataString('YourP@ss/word')
```

Generate the two secrets:

```powershell
# 32-byte base64 secrets
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Run it twice: once for `BETTER_AUTH_SECRET`, once for `FIELD_ENCRYPTION_KEY`.

> **Losing `FIELD_ENCRYPTION_KEY` makes existing encrypted passenger data
> unreadable.** Store it in your password manager or another approved secret
> store. The application refuses to write passenger data when it is missing,
> rather than silently storing plaintext.
>
> **`SEED_ADMIN_PASSWORD`**: there is no default. Use a unique development
> password of **at least 12 characters**. The seed refuses empty, short and
> well-known placeholder passwords.

---

## 5. Install dependencies and apply migrations (non-destructively)

```powershell
npm install          # installs packages and runs prisma generate
npx prisma validate  # confirm the schema is valid
npx prisma migrate status
```

To apply any pending migrations:

```powershell
npm run db:deploy    # prisma migrate deploy — applies pending migrations only
```

### Note: `prisma migrate dev` does not work with the limited `bpta_app` user

`migrate dev` creates a temporary **shadow database** and runs `ALTER` on it.
The least-privilege `bpta_app` account is not permitted to do that, and the
failure is:

```
Database error code: 1142
ALTER command denied to user 'bpta_app'@'localhost' for table 'prisma_migrate_shadow_db_…'.`session`
```

**Do not** fix this by granting global privileges, and **never** run
`prisma migrate reset` or `db push --force-reset`.

To create a NEW migration safely:

```powershell
# 1. Diff the live database against the schema (read-only)
$line = (Get-Content .env | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
$env:DATABASE_URL = $line.Substring($line.IndexOf('=')+1).Trim().Trim('"')
npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

# 2. READ the generated SQL. Confirm it only CREATEs tables / ADDs constraints.
# 3. Save it as: prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql
# 4. Apply it:
npm run db:deploy
```

All three migrations in this repository were produced and applied this way.

---

## 6. Seed synthetic data and create the development administrator

```powershell
npm run db:seed
```

What it does (all idempotent — safe to re-run):

1. Creates/updates the four provisional roles and the permission matrix.
2. Creates **one** development administrator from `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD`, if both are set. If the account already exists, the
   password is **never** changed; only the role assignment is ensured.
3. Creates a small, obviously-synthetic demo dataset (two operators, three
   vehicles, two routes, two permits, two journeys, two encrypted manifest
   entries, one CCTV inspection and one incident), unless
   `SEED_DEMO_DATA=false`.
4. Writes an audit event for the bootstrap. It never prints the password.

Inspect the result without changing anything:

```powershell
npm run db:verify
```

This is read-only: it lists tables, row counts, recent audit events and the
transport table counts.

---

## 7. Run the application

```powershell
npm run dev     # development server -> http://localhost:3000
```

Sign in at <http://localhost:3000/login> with `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`.

| URL | What it is |
|---|---|
| `/` | Database-backed operations dashboard (requires sign-in) |
| `/operators`, `/vehicles`, `/routes`, `/permits` | Phase 3 record management |
| `/trips`, `/trips/<id>` | Journeys and passenger manifests |
| `/inspections`, `/incidents` | Phase 5 compliance records |
| `/reports`, `/audit` | Reporting and the audit trail |
| `/info` … | **Public** information site (no sign-in, indexable) |

For a production-style local run:

```powershell
npm run build
npm run start
```

---

## 8. Run the checks

```powershell
npm run lint         # ESLint, fails on any warning
npm run typecheck    # strict TypeScript
npm test             # unit + live-database integration tests
npm run build        # production build
```

With the server running, in a second PowerShell window:

```powershell
npm run verify:auth    # real login -> /api/me -> sign-out -> 401
npm run verify:pages   # every page, SEO files, and authorization checks
```

Both scripts read credentials from your local `.env` and never print the
password, the session cookie or any token.

> The live database tests skip automatically if `DATABASE_URL` is missing, so a
> green `npm test` on a machine without MariaDB does **not** mean the database
> layer was exercised. Run `npm run db:verify` to prove the live connection.

---

## 9. Back up and restore the development database

The database is only reachable through your local MariaDB, so use a dump file.
**Backups must never be committed to this repository** (they may contain
synthetic — and eventually real — personal data).

### Back up

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
$env:MYSQL_PWD = "YOUR_bpta_app_PASSWORD"
D:\XAMP\mysql\bin\mysqldump.exe -u bpta_app --host=127.0.0.1 --port=3306 `
  --single-transaction --routines --triggers --databases bpta_transport_dev `
  > ".\backups\bpta_transport_dev_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
Remove-Item Env:\MYSQL_PWD
```

`.gitignore` already excludes `backups/`; confirm before adding anything new.

### Restore (into a NEW database first, never over a live one)

```powershell
D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306 `
  -e "CREATE DATABASE IF NOT EXISTS bpta_transport_dev_restore CHARACTER SET utf8mb4;"
D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306 `
  bpta_transport_dev_restore < ".\backups\<file>.sql"
```

Verify the restored database, and only then decide whether to point
`DATABASE_URL` at it. **Never** restore over the live database while the
application is running.

### Before any risky change

```powershell
git status --short --branch   # know what is uncommitted
npm run db:verify             # record the current state
# then take a dump as above
```

---

## 10. Producing the administrator password for a new machine

There is no public sign-up by design. To create an administrator on a new
machine:

1. Set `SEED_ADMIN_EMAIL` and a unique `SEED_ADMIN_PASSWORD` (12+ characters) in
   that machine's `.env`.
2. Run `npm run db:seed`.
3. Sign in, then remove the password from `.env` if you do not want it stored
   there.

The seed never overwrites an existing administrator's password, so re-running it
cannot silently rotate credentials.

---

## 11. Production evaluation (subject to departmental approval)

This prototype is **not** production ready. Before any real use, at minimum:

| Area | Required work |
|---|---|
| Hosting | Approved departmental/cloud hosting, HTTPS, WAF, network segmentation |
| Secrets | Managed KMS for `FIELD_ENCRYPTION_KEY` **and** `BETTER_AUTH_SECRET`, with documented rotation and revocation |
| Database | Dedicated MariaDB/MySQL server, TLS, restricted network access, tested backups and restore drills |
| Audit integrity | Append-only database role or write-once storage, checksum chaining, off-host shipping, monitoring |
| Abuse protection | Rate limiting, lockout, alerting on failed sign-ins |
| Identity | MFA, email verification, and an approved account-provisioning and leaver process |
| Privacy | Approved retention schedule, legal-hold handling, data-subject request procedure, DPIA |
| Legal | Confirmation of lawful basis for storing passenger identity data, and of what may be published publicly |
| Governance | Approved role/permission matrix, status vocabularies, SOPs and training |
| Quality | Penetration test, load test, automated accessibility audit, browser E2E tests, dependency scanning |

---

## 12. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `DATABASE_URL is not set` when seeding | `.env` missing. Copy `.env.example` to `.env`. The seed loads it via `prisma/load-env.ts`. |
| `ACCESS DENIED` from MariaDB | Wrong password, or the password contains special characters and was not URL-encoded in `DATABASE_URL`. |
| `Environment variable not found: DATABASE_URL` from Prisma CLI | Run the command from the project root so Prisma finds `.env`. |
| Sign-in returns 500 | Check `FIELD_ENCRYPTION_KEY` is not required for auth, but verify `.env` is valid and MariaDB is running. |
| “Passenger data cannot be stored” | `FIELD_ENCRYPTION_KEY` is missing or is not a 32-byte base64/hex key. Generate a new one. |
| Passenger records unreadable after changing the key | The key changed. Restore the original key — existing ciphertext cannot be decrypted with a different key. |
| `prisma migrate dev` fails with error 1142 | Expected. Use the `migrate diff` + `migrate deploy` procedure in section 5. |
| Redirect loop on the login page | Should not occur — it was fixed in Phase 2 (defect C). If it does, clear the `better-auth.session_token` cookie and report it. |
| Port 3000 already in use | Stop the other process, or use a different `BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` and port. |

---

## 13. Handover checklist

- [ ] MariaDB running; `db/setup-db.sql` executed with a unique password.
- [ ] `.env` created, with a unique `SEED_ADMIN_PASSWORD` and a stored
      `FIELD_ENCRYPTION_KEY`.
- [ ] `npm install`, `npx prisma validate`, `npm run db:deploy` all succeeded.
- [ ] `npm run db:seed` created roles, the administrator and demo data.
- [ ] `npm run db:verify` shows the expected tables and rows.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.
- [ ] `npm run verify:auth` and `npm run verify:pages` both report all checks
      passed against the running server.
- [ ] A database dump has been taken and stored outside this repository.
- [ ] The department is aware the system is unapproved and that all roles,
      statuses and content are provisional.
