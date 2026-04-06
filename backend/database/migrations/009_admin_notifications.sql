CREATE TABLE IF NOT EXISTS admin_notifications (
  notification_id BIGSERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_key VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  event_created_at TIMESTAMP NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_event_created_at
  ON admin_notifications(event_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_status
  ON admin_notifications(is_deleted, is_read);
