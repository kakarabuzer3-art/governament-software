-- ============================================================================
--  Safe database setup for local development (MariaDB via XAMPP).
--
--  WHAT THIS DOES
--    1. Creates the development database: bpta_transport_dev
--    2. Creates TWO application users with SEPARATED privileges:
--         bpta_app      -> runtime only: SELECT/INSERT/UPDATE/DELETE.
--                          Cannot CREATE, ALTER or DROP anything.
--         bpta_migrate  -> schema migrations: DDL on this database only.
--                          Used ONLY by `prisma migrate deploy`, never by the
--                          running application.
--
--  WHY TWO USERS (Phase C hardening, GAP-08)
--    The runtime credential is the one exposed to the web application. If it
--    also held DDL rights, a single SQL-injection or credential leak could
--    DROP or ALTER tables. Separating the two means a compromised runtime
--    credential can only read and write rows — it cannot destroy the schema.
--
--  WHAT IT DOES NOT DO
--    - It never drops, resets, truncates or deletes anything.
--    - It never grants global (server-wide) privileges.
--    - It never reuses the `root` account for the application.
--
--  HOW TO RUN (pick ONE) — must be run as an account that can CREATE USER
--  (normally `root`; bpta_app deliberately cannot do this):
--
--    phpMyAdmin:  http://localhost/phpmyadmin  -> SQL tab -> paste -> Go
--    Command line (PowerShell), as root:
--      D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306 `
--        -e "SOURCE C:/Users/Abuzer Kakar/Desktop/Goverament software/db/setup-db.sql"
--
--  IMPORTANT: replace 'CHANGE_THIS_RUNTIME_PASSWORD' and
--  'CHANGE_THIS_MIGRATE_PASSWORD' below with strong passwords YOU choose.
--  Put them (URL-encoded) into your git-ignored .env:
--      DATABASE_URL        -> bpta_app     (runtime, used by the app)
--      MIGRATE_DATABASE_URL -> bpta_migrate (used only by migration commands)
--  Never commit either password or paste them into a chat.
--
--  NOTE FOR EXISTING INSTALLATIONS
--    Re-running this file is safe: CREATE USER IF NOT EXISTS and GRANT are
--    additive and never revoke anything. An existing bpta_app that still holds
--    ALL PRIVILEGES keeps them until an administrator revokes them explicitly
--    with the REVOKE statement at the bottom of this file. That REVOKE is
--    commented out on purpose: running it during working hours will break
--    `prisma migrate` for anyone still pointing it at bpta_app.
-- ============================================================================

-- 1. Database (IF NOT EXISTS so re-running is safe and non-destructive).
CREATE DATABASE IF NOT EXISTS bpta_transport_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Runtime application user (least privilege).
--    Created for BOTH '127.0.0.1' and 'localhost' because MariaDB treats them
--    as different hosts (avoids confusing "access denied" errors).
CREATE USER IF NOT EXISTS 'bpta_app'@'127.0.0.1'     IDENTIFIED BY 'CHANGE_THIS_RUNTIME_PASSWORD';
CREATE USER IF NOT EXISTS 'bpta_app'@'localhost'     IDENTIFIED BY 'CHANGE_THIS_RUNTIME_PASSWORD';

-- 3. Migration user (DDL). Only for `prisma migrate deploy`.
CREATE USER IF NOT EXISTS 'bpta_migrate'@'127.0.0.1' IDENTIFIED BY 'CHANGE_THIS_MIGRATE_PASSWORD';
CREATE USER IF NOT EXISTS 'bpta_migrate'@'localhost' IDENTIFIED BY 'CHANGE_THIS_MIGRATE_PASSWORD';

-- 4. Runtime privileges: data manipulation ONLY. No CREATE/ALTER/DROP/INDEX.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON bpta_transport_dev.* TO 'bpta_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON bpta_transport_dev.* TO 'bpta_app'@'localhost';

-- 5. Migration privileges: schema changes, scoped to this database only.
--    (ALTER and INDEX are needed to add columns and indexes; REFERENCES for
--    foreign keys; CREATE for new tables.)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON bpta_transport_dev.* TO 'bpta_migrate'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON bpta_transport_dev.* TO 'bpta_migrate'@'localhost';

FLUSH PRIVILEGES;

-- ============================================================================
--  OPTIONAL: move an EXISTING installation onto the split model.
--
--  Run these ONLY after you have updated .env and confirmed that migrations
--  work with MIGRATE_DATABASE_URL. Revoking first will lock you out of DDL.
--
--  REVOKE ALL PRIVILEGES ON bpta_transport_dev.* FROM 'bpta_app'@'127.0.0.1';
--  REVOKE ALL PRIVILEGES ON bpta_transport_dev.* FROM 'bpta_app'@'localhost';
--  GRANT SELECT, INSERT, UPDATE, DELETE ON bpta_transport_dev.* TO 'bpta_app'@'127.0.0.1';
--  GRANT SELECT, INSERT, UPDATE, DELETE ON bpta_transport_dev.* TO 'bpta_app'@'localhost';
--  FLUSH PRIVILEGES;
--
--  Verify with:
--      SHOW GRANTS FOR 'bpta_app'@'127.0.0.1';
--
--  To rotate a password later:
--      ALTER USER 'bpta_app'@'127.0.0.1' IDENTIFIED BY 'NEW_STRONG_PASSWORD';
--      FLUSH PRIVILEGES;
-- ============================================================================
