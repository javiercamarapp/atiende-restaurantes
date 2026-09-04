#!/usr/bin/env bash
set -euo pipefail

database_url="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
restaurant_id="68000000-0000-0000-0000-000000000001"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/atiende-outbox-race.XXXXXX")"
trap 'rm -rf "$scratch"' EXIT

psql "$database_url" -X -v ON_ERROR_STOP=1 -q <<SQL
delete from public.restaurants where id = '$restaurant_id';
insert into public.restaurants(id,name,slug) values ('$restaurant_id','Outbox race','outbox-race');
select public.enqueue_messaging_outbox('$restaurant_id','whatsapp','reply','race:1','{"to":"mock","body":"mock"}');
SQL

psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt \
  -c "select count(*) from public.claim_messaging_outbox_batch('worker-a',1,60) where restaurant_id='$restaurant_id'" \
  >"$scratch/a" &
first_pid=$!
psql "$database_url" -X -v ON_ERROR_STOP=1 -qAt \
  -c "select count(*) from public.claim_messaging_outbox_batch('worker-b',1,60) where restaurant_id='$restaurant_id'" \
  >"$scratch/b" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

claims=$(( $(tr -d '[:space:]' <"$scratch/a") + $(tr -d '[:space:]' <"$scratch/b") ))
psql "$database_url" -X -v ON_ERROR_STOP=1 -q -c "delete from public.restaurants where id='$restaurant_id'"
if [[ "$claims" -ne 1 ]]; then
  echo "expected one fenced claim, got $claims" >&2
  exit 1
fi
echo "concurrent outbox claim: exactly one worker"
