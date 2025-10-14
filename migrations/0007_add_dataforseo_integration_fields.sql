-- Add Data for SEO API integration fields to client_integrations table
-- These store encrypted login and password for Data for SEO API access

ALTER TABLE client_integrations 
ADD COLUMN IF NOT EXISTS dataforseo_login TEXT,
ADD COLUMN IF NOT EXISTS dataforseo_password TEXT,
ADD COLUMN IF NOT EXISTS dataforseo_login_iv TEXT,
ADD COLUMN IF NOT EXISTS dataforseo_password_iv TEXT,
ADD COLUMN IF NOT EXISTS dataforseo_login_auth_tag TEXT,
ADD COLUMN IF NOT EXISTS dataforseo_password_auth_tag TEXT;

COMMENT ON COLUMN client_integrations.dataforseo_login IS 'Data for SEO API login (AES-256-GCM encrypted)';
COMMENT ON COLUMN client_integrations.dataforseo_password IS 'Data for SEO API password/key (AES-256-GCM encrypted)';
COMMENT ON COLUMN client_integrations.dataforseo_login_iv IS 'Initialization vector for login encryption';
COMMENT ON COLUMN client_integrations.dataforseo_password_iv IS 'Initialization vector for password encryption';
COMMENT ON COLUMN client_integrations.dataforseo_login_auth_tag IS 'Authentication tag for login decryption';
COMMENT ON COLUMN client_integrations.dataforseo_password_auth_tag IS 'Authentication tag for password decryption';
