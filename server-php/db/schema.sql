-- Angaar Dhaba — MySQL schema
-- Run this once against your database (phpMyAdmin's "Import" tab in cPanel,
-- or `mysql -u user -p dbname < schema.sql`).
--
-- Mirrors the same order shape the app has always used (first localStorage,
-- then MongoDB) — just normalized into real tables instead of one document
-- with an embedded items array, since MySQL doesn't have that. Timestamps
-- are stored as BIGINT milliseconds (not MySQL's DATETIME) to match
-- JavaScript's Date.now(), which the frontend has always used directly for
-- formatting — no timezone conversion needed on either side.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id                    VARCHAR(32)  NOT NULL PRIMARY KEY,   -- e.g. EP1A2B3C4D5
  table_no              VARCHAR(50)  NOT NULL,
  status                ENUM('new','preparing','ready','delivered','bill_requested','paid') NOT NULL DEFAULT 'new',
  payment_method_requested VARCHAR(20) DEFAULT NULL,
  payment_method        VARCHAR(20)  DEFAULT NULL,
  bill_requested_at     BIGINT       DEFAULT NULL,
  paid_at               BIGINT       DEFAULT NULL,
  created_at            BIGINT       NOT NULL,
  updated_at            BIGINT       NOT NULL,
  notes                 TEXT,
  placed_by             ENUM('customer','waiter') NOT NULL DEFAULT 'customer',
  waiter_name           VARCHAR(100) DEFAULT '',
  bill_id               VARCHAR(32)  DEFAULT NULL,

  -- Set once by generate-invoice.php and never recalculated after, so a
  -- bill's GST/total stays fixed even if the GST rate changes later.
  gst_rate              DECIMAL(5,2)  DEFAULT NULL,
  half_rate             DECIMAL(5,2)  DEFAULT NULL,
  gst_amount            DECIMAL(10,2) DEFAULT NULL,
  cgst_amount            DECIMAL(10,2) DEFAULT NULL,
  sgst_amount            DECIMAL(10,2) DEFAULT NULL,
  bill_subtotal         DECIMAL(10,2) DEFAULT NULL,
  bill_total             DECIMAL(10,2) DEFAULT NULL,
  invoice_no             VARCHAR(30)   DEFAULT NULL,
  invoice_generated_at  BIGINT        DEFAULT NULL,

  INDEX idx_table (table_no),
  INDEX idx_status (status),
  INDEX idx_bill_id (bill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_id       VARCHAR(32)   NOT NULL,
  name           VARCHAR(200)  NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  qty            INT           NOT NULL DEFAULT 1,
  special        TINYINT(1)    NOT NULL DEFAULT 0,
  print_station  ENUM('KITCHEN','BAR') NOT NULL DEFAULT 'KITCHEN',

  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print_jobs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     VARCHAR(32) NOT NULL,
  table_no     VARCHAR(50) NOT NULL,
  station      ENUM('KITCHEN','BAR','BILLING') NOT NULL,
  content      TEXT NOT NULL,
  status       ENUM('pending','printed','failed') NOT NULL DEFAULT 'pending',
  attempts     INT NOT NULL DEFAULT 0,
  last_error   VARCHAR(500) DEFAULT '',
  created_at   BIGINT NOT NULL,
  printed_at   BIGINT DEFAULT NULL,

  INDEX idx_status_station (status, station)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row atomic counter for invoice numbers (INV-EKP-000001, ...).
-- Updated via `UPDATE invoice_seq SET seq = LAST_INSERT_ID(seq + 1)` which
-- MySQL guarantees is atomic even under concurrent requests — the
-- equivalent of the MongoDB $inc counter, just MySQL's native idiom for it.
CREATE TABLE IF NOT EXISTS invoice_seq (
  id   TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  seq  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO invoice_seq (id, seq) VALUES (1, 0)
  ON DUPLICATE KEY UPDATE id = id;

-- One row per real page load of a customer-facing page (Home, Menu — see
-- track_visit.php), so the Sales Dashboard's "Website visits" chart reflects
-- actual traffic instead of a guess.
CREATE TABLE IF NOT EXISTS page_views (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  page        VARCHAR(30) NOT NULL,
  created_at  BIGINT NOT NULL,

  INDEX idx_page (page),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
