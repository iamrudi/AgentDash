-- Add project_id and invoice_id references to initiatives table
-- These track the automatically created project and invoice when an initiative is approved

ALTER TABLE initiatives 
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS initiatives_project_id_idx ON initiatives(project_id);
CREATE INDEX IF NOT EXISTS initiatives_invoice_id_idx ON initiatives(invoice_id);

COMMENT ON COLUMN initiatives.project_id IS 'Project automatically created when initiative is approved';
COMMENT ON COLUMN initiatives.invoice_id IS 'Invoice automatically generated when paid initiative is approved';
