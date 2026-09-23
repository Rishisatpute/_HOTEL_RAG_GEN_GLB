-- Adds counter-applied discount support to an EXISTING database (one where
-- `orders`/`invoice_log` were already created before this feature existed).
-- schema.sql's CREATE TABLE IF NOT EXISTS won't add these columns to a table
-- that's already there, so run this once against your live DB — MilesWeb's
-- cPanel phpMyAdmin "SQL" tab, or `mysql -u user -p dbname < migration_discount.sql`.
-- Run this ONCE — MySQL (unlike MariaDB) has no "ADD COLUMN IF NOT EXISTS",
-- so running it a second time fails with "Duplicate column name", which just
-- means it's already applied.

ALTER TABLE orders
  ADD COLUMN discount_pct    DECIMAL(5,2)  DEFAULT NULL AFTER sgst_amount,
  ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT NULL AFTER discount_pct;

ALTER TABLE invoice_log
  ADD COLUMN discount_pct    DECIMAL(5,2)  DEFAULT NULL AFTER amount,
  ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT NULL AFTER discount_pct;
