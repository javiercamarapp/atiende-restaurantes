begin;

do $$
begin
  if not public.consume_api_rate_limit('test-a', repeat('a', 64), 2, 60) then
    raise exception 'first request must be allowed';
  end if;
  if not public.consume_api_rate_limit('test-a', repeat('a', 64), 2, 60) then
    raise exception 'request at limit must be allowed';
  end if;
  if public.consume_api_rate_limit('test-a', repeat('a', 64), 2, 60) then
    raise exception 'request over limit must be rejected';
  end if;
  if not public.consume_api_rate_limit('test-b', repeat('a', 64), 2, 60) then
    raise exception 'scope must have an independent bucket';
  end if;
  if not public.consume_api_rate_limit('test-a', repeat('b', 64), 2, 60) then
    raise exception 'actor must have an independent bucket';
  end if;
  if public.consume_api_rate_limit('', repeat('c', 64), 2, 60) then
    raise exception 'empty scope must be rejected';
  end if;
  if public.consume_api_rate_limit('test', 'not-a-hash', 2, 60) then
    raise exception 'raw actor values must be rejected';
  end if;
end;
$$;

delete from public.api_rate_limits where scope like 'test-%';
rollback;
