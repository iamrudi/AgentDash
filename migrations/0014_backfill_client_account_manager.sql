-- Backfill account manager assignment for existing clients.
-- Rule: if a client has no account_manager_profile_id, assign the earliest-created
-- Admin profile in the same agency. SuperAdmin and non-admin roles are excluded.

UPDATE clients c
SET account_manager_profile_id = candidate.admin_profile_id
FROM (
  SELECT
    c2.id AS client_id,
    (
      SELECT p.id
      FROM profiles p
      WHERE p.agency_id = c2.agency_id
        AND p.role = 'Admin'
      ORDER BY p.created_at ASC
      LIMIT 1
    ) AS admin_profile_id
  FROM clients c2
  WHERE c2.account_manager_profile_id IS NULL
) AS candidate
WHERE c.id = candidate.client_id
  AND candidate.admin_profile_id IS NOT NULL;
