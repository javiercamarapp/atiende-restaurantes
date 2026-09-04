#!/usr/bin/env bash
set -euo pipefail

database_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
version="20260901000000"

# Simulates a hosted ledger created from origin/main: the schema already has
# later objects, but the newly captured foundation migration is absent.
psql "$database_url" -X -v ON_ERROR_STOP=1 -q \
  -c "delete from supabase_migrations.schema_migrations where version='$version'"
supabase db push --local --include-all --yes >/dev/null

result="$(psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt <<'SQL'
select
  (select count(*) from supabase_migrations.schema_migrations where version='20260901000000') || ':' ||
  (select relrowsecurity::int from pg_class where oid='public.restaurant_staff'::regclass) || ':' ||
  (select count(*) from pg_policies where schemaname='public' and tablename='restaurant_staff' and cmd='UPDATE');
SQL
)"
if [[ "$result" != "1:1:0" ]]; then
  echo "out-of-order upgrade invariant failed: $result" >&2
  exit 1
fi
echo "out-of-order migration upgrade: applied once, RLS on, no broad membership UPDATE policy"
