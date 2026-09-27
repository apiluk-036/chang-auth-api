-- Email verification, token revocation, admin role, and one-time email tokens.

ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME NULL AFTER full_name,
  MODIFY COLUMN role ENUM('user', 'staff', 'agency', 'admin') NOT NULL DEFAULT 'user',
  -- Bumped on logout / password change / reset. Every JWT carries the version it
  -- was issued with, and a token whose version no longer matches is rejected.
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER role;

-- One-time links sent by email. Only the SHA-256 of the token is stored, so a
-- leaked database cannot be used to reset anyone's password.
CREATE TABLE IF NOT EXISTS email_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  purpose    ENUM('verify_email', 'reset_password') NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,          -- UTC
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_email_tokens_user (user_id, purpose),
  CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
