-- ==========================================================================
-- Ondea Finance — Schéma MySQL 8 / MariaDB 10.6+ (utf8mb4)
-- Version multi-utilisateur : chaque ligne appartient à une entreprise
-- (company_id) ; les utilisateurs sont rattachés à une entreprise.
-- Montants en CENTIMES (BIGINT) — identique au front-end.
-- ==========================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- password_hash(..., PASSWORD_DEFAULT)
  display_name VARCHAR(80) NOT NULL,
  role ENUM('admin','comptable','lecture') NOT NULL DEFAULT 'admin',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  company_id INT UNSIGNED PRIMARY KEY,
  data JSON NOT NULL,
  initialized TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  bank VARCHAR(60) NULL,
  iban VARCHAR(40) NULL,
  opening_balance BIGINT NOT NULL DEFAULT 0,
  color VARCHAR(9) NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_acc_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  type ENUM('depense','recette') NOT NULL,
  color VARCHAR(9) NULL,
  icon VARCHAR(16) NULL,
  neutral TINYINT(1) NOT NULL DEFAULT 0,
  `system` VARCHAR(20) NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_cat_company (company_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS third_parties (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  kind ENUM('fournisseur','client') NOT NULL,
  name VARCHAR(80) NOT NULL,
  siret VARCHAR(17) NULL,
  email VARCHAR(120) NULL,
  phone VARCHAR(25) NULL,
  address VARCHAR(160) NULL,
  city VARCHAR(60) NULL,
  payment_terms SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  notes TEXT NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_tp_company (company_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  account_id VARCHAR(40) NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_pm_company (company_id),
  CONSTRAINT fk_pm_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  type ENUM('depense','recette') NOT NULL,
  date DATE NOT NULL,
  label VARCHAR(160) NOT NULL,
  amount_ht BIGINT NOT NULL,
  amount_vat BIGINT NOT NULL,
  amount_ttc BIGINT NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  base ENUM('ht','ttc') NULL,
  status ENUM('payee','en_attente') NOT NULL,
  category_id VARCHAR(40) NOT NULL,
  third_party_id VARCHAR(40) NULL,
  payment_method_id VARCHAR(40) NULL,
  account_id VARCHAR(40) NOT NULL,
  reference VARCHAR(60) NULL,
  notes TEXT NULL,
  attachments JSON NULL,
  invoice_id VARCHAR(40) NULL,
  schedule_id VARCHAR(40) NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_tx_company_date (company_id, date),
  INDEX ix_tx_category (category_id),
  INDEX ix_tx_tp (third_party_id),
  CONSTRAINT fk_tx_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_tx_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_tx_tp FOREIGN KEY (third_party_id) REFERENCES third_parties(id),
  CONSTRAINT fk_tx_pm FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  direction ENUM('client','fournisseur') NOT NULL,
  number VARCHAR(40) NOT NULL,
  third_party_id VARCHAR(40) NOT NULL,
  category_id VARCHAR(40) NOT NULL,
  label VARCHAR(160) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_ht BIGINT NOT NULL,
  amount_vat BIGINT NOT NULL,
  amount_ttc BIGINT NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('brouillon','emise','payee') NOT NULL,
  paid_date DATE NULL,
  transaction_id VARCHAR(40) NULL,
  attachments JSON NULL,
  notes TEXT NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_inv_company (company_id, direction, status),
  INDEX ix_inv_due (due_date),
  CONSTRAINT fk_inv_tp FOREIGN KEY (third_party_id) REFERENCES third_parties(id),
  CONSTRAINT fk_inv_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedules (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  type ENUM('depense','recette') NOT NULL,
  label VARCHAR(160) NOT NULL,
  frequency ENUM('mensuelle','trimestrielle','semestrielle','annuelle','ponctuelle') NOT NULL,
  next_date DATE NOT NULL,
  end_date VARCHAR(10) NULL,
  amount_ht BIGINT NOT NULL,
  amount_vat BIGINT NOT NULL,
  amount_ttc BIGINT NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  category_id VARCHAR(40) NOT NULL,
  third_party_id VARCHAR(40) NULL,
  account_id VARCHAR(40) NOT NULL,
  payment_method_id VARCHAR(40) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_sch_company (company_id, next_date),
  CONSTRAINT fk_sch_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_sch_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budgets (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  category_id VARCHAR(40) NOT NULL,
  period ENUM('mensuel','annuel') NOT NULL,
  amount BIGINT NOT NULL,
  alert DECIMAL(5,2) NOT NULL DEFAULT 80,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  UNIQUE KEY uq_budget (company_id, category_id),
  CONSTRAINT fk_bud_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfers (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  from_id VARCHAR(40) NOT NULL,
  to_id VARCHAR(40) NOT NULL,
  amount BIGINT NOT NULL,
  label VARCHAR(80) NULL,
  created_at VARCHAR(30) NULL, updated_at VARCHAR(30) NULL,
  INDEX ix_trf_company (company_id, date),
  CONSTRAINT fk_trf_from FOREIGN KEY (from_id) REFERENCES accounts(id),
  CONSTRAINT fk_trf_to FOREIGN KEY (to_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(40) PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(120) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  folder VARCHAR(20) NOT NULL DEFAULT 'justificatifs',
  tags JSON NULL,
  note VARCHAR(300) NULL,
  storage_path VARCHAR(255) NOT NULL,           -- chemin hors racine web
  created_at VARCHAR(30) NULL,
  INDEX ix_files_company (company_id, folder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Entreprise et utilisateur initiaux (mot de passe à changer : « ChangezMoi!2026 »)
INSERT IGNORE INTO companies (id, name) VALUES (1, 'Mon entreprise');
INSERT IGNORE INTO settings (company_id, data, initialized) VALUES (1, JSON_OBJECT('companyName', 'Mon entreprise'), 0);
