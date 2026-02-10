-- Governed control-plane artifacts (Opportunity → Gate → Initiative → SKU → Output → Outcome → Learning)

CREATE TABLE opportunity_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  opportunity_statement TEXT NOT NULL,
  reasoning TEXT,
  assumptions JSONB,
  confidence TEXT,
  evidence_refs JSONB,
  risks JSONB,
  suggested_success_criteria JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS opportunity_artifacts_agency_id_idx ON opportunity_artifacts(agency_id);
CREATE INDEX IF NOT EXISTS opportunity_artifacts_client_id_idx ON opportunity_artifacts(client_id);

CREATE TABLE gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  gate_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gate_decisions_agency_id_idx ON gate_decisions(agency_id);
CREATE INDEX IF NOT EXISTS gate_decisions_target_idx ON gate_decisions(target_type, target_id);

CREATE TABLE initiative_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  intent_statement TEXT NOT NULL,
  constraints JSONB,
  success_criteria JSONB,
  boundary_conditions JSONB,
  evaluation_horizon TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS initiative_intents_initiative_id_idx ON initiative_intents(initiative_id);

CREATE TABLE sku_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  execution_skus JSONB,
  frozen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sku_compositions_initiative_id_idx ON sku_compositions(initiative_id);

CREATE TABLE execution_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  output JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_outputs_initiative_id_idx ON execution_outputs(initiative_id);

CREATE TABLE outcome_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  outcome_summary TEXT,
  kpi_delta JSONB,
  qualitative_feedback JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS outcome_reviews_initiative_id_idx ON outcome_reviews(initiative_id);

CREATE TABLE learning_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  learning TEXT NOT NULL,
  invalidated_assumptions JSONB,
  confidence TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_artifacts_initiative_id_idx ON learning_artifacts(initiative_id);

-- Link initiatives to their approved opportunity artifacts
ALTER TABLE initiatives
ADD COLUMN opportunity_artifact_id UUID REFERENCES opportunity_artifacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS initiatives_opportunity_artifact_id_idx ON initiatives(opportunity_artifact_id);
