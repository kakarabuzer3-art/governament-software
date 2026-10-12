-- ============================================================================
--  Safe database setup for local development (MariaDB via XAMPP).
--
--  What this does:
--   1. Creates the development database: bpta_transport_dev
--   2. Creates an APPLICATION-ONLY user: bpta_app (least privilege — it only
--      gets rights on bpta_transport_dev, never global admin rights).
--
--  It does NOT:
--   - Drop or reset anything.
--   - Use the application's root account for the app itself.
--
--  HOW TO RUN (pick ONE):
--   phpMyAdmin:  http://localhost/phpmyadmin  → SQL tab → paste → Go
--   Command line (PowerShell), as root:
--     D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306 -e "SOURCE C:/Users/Abuzer Kakar/Desktop/Goverament software/db/setup-db.sql"
--
--  IMPORTANT: replace 'CHANGE_THIS_STRONG_PASSWORD' below with a strong
--  password YOU choose. Then put the SAME password (URL-encoded) into your
--  .env DATABASE_URL. Never commit that password or paste it into a chat.
-- ============================================================================

-- 1. Database (IF NOT EXISTS so re-running is safe and non-destructive).
CREATE DATABASE IF NOT EXISTS bpta_transport_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Application-only user. Created for BOTH '127.0.0.1' and 'localhost'
--    because MariaDB treats them as different hosts (avoids "access denied").
CREATE USER IF NOT EXISTS 'bpta_app'@'127.0.0.1' IDENTIFIED BY 'CHANGE_THIS_STRONG_PASSWORD';
CREATE USER IF NOT EXISTS 'bpta_app'@'localhost'  IDENTIFIED BY 'CHANGE_THIS_STRONG_PASSWORD';

-- 3. Grant ONLY what the app needs, and ONLY on its own database.
GRANT ALL PRIVILEGES ON bpta_transport_dev.* TO 'bpta_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON bpta_transport_dev.* TO 'bpta_app'@'localhost';

FLUSH PRIVILEGES;

-- If you need to CHANGE an existing password later, run (adjust password):
--   ALTER USER 'bpta_app'@'127.0.0.1' IDENTIFIED BY 'NEW_STRONG_PASSWORD';
--   ALTER USER 'bpta_app'@'localhost'  IDENTIFIED BY 'NEW_STRONG_PASSWORD';
--   FLUSH PRIVILEGES;
