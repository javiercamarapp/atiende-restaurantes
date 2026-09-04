#!/usr/bin/env bash
set -euo pipefail

database_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
restaurant_id="53000000-0000-0000-0000-000000000001"
branch_id="53000000-0000-0000-0000-000000000002"
customer_id="53000000-0000-0000-0000-000000000003"
fingerprint="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

psql "$database_url" -X -v ON_ERROR_STOP=1 \
  -v restaurant_id="$restaurant_id" -v branch_id="$branch_id" -v customer_id="$customer_id" <<'SQL'
delete from public.orders where restaurant_id = :'restaurant_id';
delete from public.customers where restaurant_id = :'restaurant_id';
delete from public.branches where restaurant_id = :'restaurant_id';
delete from public.restaurants where id = :'restaurant_id';
insert into public.restaurants(id, name, slug) values (:'restaurant_id', 'Concurrency Test', 'concurrency-test');
insert into public.branches(id, restaurant_id, name, slug, address, is_active)
values (:'branch_id', :'restaurant_id', 'Branch', 'concurrency-test-branch', 'Test', true);
insert into public.customers(id, restaurant_id, phone, name, order_count)
values (:'customer_id', :'restaurant_id', '9991111111', 'Concurrent', 0);
SQL

payload="$(printf '{\"customer_name\":\"Concurrent\",\"customer_phone\":\"9991111111\",\"customer_id\":\"%s\",\"restaurant_id\":\"%s\",\"branch\":\"Branch\",\"branch_id\":\"%s\",\"total\":100,\"items\":[{\"id\":\"p1\",\"name\":\"Product\",\"price\":100,\"quantity\":1}],\"source\":\"web\"}' "$customer_id" "$restaurant_id" "$branch_id")"

psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt \
  -c "select create_order_idempotent('$payload'::jsonb, '$fingerprint', null)->>'id'" &
first_pid=$!
psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt \
  -c "select create_order_idempotent('$payload'::jsonb, '$fingerprint', null)->>'id'" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

result="$(psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt \
  -c "select count(*) || ':' || (select order_count from public.customers where id = '$customer_id') from public.orders where restaurant_id = '$restaurant_id'")"

psql "$database_url" -X -v ON_ERROR_STOP=1 -q <<SQL
delete from public.orders where restaurant_id = '$restaurant_id';
delete from public.customers where restaurant_id = '$restaurant_id';
delete from public.branches where restaurant_id = '$restaurant_id';
delete from public.restaurants where id = '$restaurant_id';
SQL

if [[ "$result" != "1:1" ]]; then
  echo "expected one order and one customer increment, got $result" >&2
  exit 1
fi

echo "concurrent order idempotency: 1 order, 1 customer increment"
