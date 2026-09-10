-- Protect temporary WebISS capability headers while retaining existing pg_net ACLs elsewhere.
BEGIN;
REVOKE SELECT ON TABLE net.http_request_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT(id) ON TABLE net.http_request_queue TO PUBLIC,anon,authenticated;
-- The SECURITY DEFINER import enqueue retains its owner's queue access.
-- This intentionally does not harden generic HTTP execution, writes or response access.
-- Invoker HTTP functions retain INSERT ... RETURNING id without access to body or headers.
COMMIT;
