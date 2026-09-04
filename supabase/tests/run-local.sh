#!/usr/bin/env bash
set -euo pipefail

database_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
tests=(
  supabase/tests/enterprise_tenant_isolation.sql
  supabase/tests/api_rate_limits.sql
  supabase/tests/whatsapp_delivery.sql
  supabase/tests/order_idempotency.sql
  supabase/tests/admin_channel_stats.sql
  supabase/tests/privilege_escalation.sql
  supabase/tests/messaging_outbox.sql
  supabase/tests/privacy_dsar.sql
  supabase/tests/operational_observability.sql
)

for test_file in "${tests[@]}"; do
  echo "running $test_file"
  psql "$database_url" -X -v ON_ERROR_STOP=1 -f "$test_file"
done

bash supabase/tests/order_idempotency_concurrency.sh "$database_url"
bash supabase/tests/messaging_outbox_concurrency.sh "$database_url"
