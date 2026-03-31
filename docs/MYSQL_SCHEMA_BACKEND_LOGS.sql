USE woocommerce_ai_customer_support;

CREATE TABLE IF NOT EXISTS bai_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  conversation_uid CHAR(36) NOT NULL,
  session_id VARCHAR(128) NULL,
  site_url VARCHAR(255) NULL,
  status ENUM('normal','escalated','closed') NOT NULL DEFAULT 'normal',
  escalated_at TIMESTAMP(6) NULL,
  escalation_reason VARCHAR(64) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation_uid (conversation_uid),
  KEY idx_session_id (session_id),
  KEY idx_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bai_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  conversation_id BIGINT UNSIGNED NOT NULL,
  role ENUM('user','assistant','system') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  request_id VARCHAR(64) NULL,
  meta_json LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY idx_conv_time (conversation_id, created_at),
  KEY idx_role (role),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES bai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bai_openai_calls (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  conversation_id BIGINT UNSIGNED NOT NULL,
  trigger_message_id BIGINT UNSIGNED NULL,
  request_id VARCHAR(64) NULL,
  model VARCHAR(64) NULL,
  temperature DECIMAL(4,2) NULL,
  prompt_messages_json LONGTEXT NULL,
  response_json LONGTEXT NULL,
  reply_text MEDIUMTEXT NULL,
  ok TINYINT(1) NOT NULL DEFAULT 1,
  error_type VARCHAR(64) NULL,
  error_message TEXT NULL,
  latency_ms INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_conv_time (conversation_id, created_at),
  KEY idx_request_id (request_id),
  KEY idx_ok (ok, created_at),
  CONSTRAINT fk_calls_conversation
    FOREIGN KEY (conversation_id) REFERENCES bai_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_calls_trigger_message
    FOREIGN KEY (trigger_message_id) REFERENCES bai_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bai_escalations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  conversation_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(64) NULL,
  source VARCHAR(32) NOT NULL,
  reason VARCHAR(64) NULL,
  contact_name VARCHAR(128) NULL,
  contact_email VARCHAR(190) NULL,
  note TEXT NULL,
  transcript_json LONGTEXT NULL,
  make_webhook_ok TINYINT(1) NOT NULL DEFAULT 0,
  make_webhook_error TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_conv_time (conversation_id, created_at),
  KEY idx_reason (reason, created_at),
  CONSTRAINT fk_escalations_conversation
    FOREIGN KEY (conversation_id) REFERENCES bai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bai_make_webhook_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  escalation_id BIGINT UNSIGNED NULL,
  event VARCHAR(64) NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  reason VARCHAR(64) NOT NULL,
  make_url VARCHAR(512) NOT NULL,
  request_payload LONGTEXT NOT NULL,
  response_status INT NULL,
  response_body LONGTEXT NULL,
  ok TINYINT(1) NOT NULL DEFAULT 0,
  error TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_escalation_id (escalation_id),
  KEY idx_request_id (request_id),
  KEY idx_ok (ok, created_at),
  CONSTRAINT fk_make_logs_escalation
    FOREIGN KEY (escalation_id) REFERENCES bai_escalations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
