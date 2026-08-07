-- 0018 verification. Expect exactly 20 rows, every `result` the text 'true'.
-- The seed counts are visible over REST; everything below them is not —
-- column privileges, an FK's delete action, a missing policy and a function
-- body are exactly what a table probe cannot show you (HANDOFF §3.1).
--
-- Every check is an aggregate, deliberately. An aggregate over zero matching
-- catalog rows still returns one row, so a MISSING object reports 'false'
-- instead of dropping out of the result set. An earlier draft used bare
-- projections for the five function/FK checks: if the function did not exist
-- you got 19 rows of 'true' and nothing false to notice. Fewer than 20 rows
-- now means the script did not finish, not that a check passed.
select 'agents seeded (16)'      as check, (count(*) = 16)::text as result from public.agents where source = 'library'
union all select 'gates seeded (6)',        (count(*) =  6)::text from public.agent_gates
union all select 'enabled matches registry (9)', (count(*) = 9)::text from public.agents where source = 'library' and enabled
union all select 'enabled ceiling ($260)',  (round(sum(spec_monthly_cap_usd)) = 260)::text from public.agents where source='library' and enabled
union all select 'total ceiling ($420)',    (round(sum(spec_monthly_cap_usd)) = 420)::text from public.agents where source='library'
union all select 'layers 8/5/3',            (count(*) filter (where layer='enterprise')=8
                                          and count(*) filter (where layer='department')=5
                                          and count(*) filter (where layer='product')=3)::text
                                            from public.agents where source='library'
union all select 'work_order_events append-only (2 policies, r+a)',
       (count(*) = 2 and string_agg(polcmd::text,',' order by polcmd::text) = 'a,r')::text
       from pg_policy where polrelid = 'public.work_order_events'::regclass
union all select 'events FK is RESTRICT not CASCADE',
       -- `like` can match more than one constraint; require exactly one, and
       -- require that one to be RESTRICT ('r'), not merely to exist.
       (count(*) = 1)::text from pg_constraint
       where conname like 'work_order_events_work_order_id%' and confdeltype = 'r'
-- These two use has_column_privilege(), not information_schema. The earlier
-- draft read information_schema.column_privileges, which reports GRANTS and
-- not effective access — it cannot see that a table-level grant overrides a
-- column-level revoke. That is exactly the defect 0019 fixes, and the wrong
-- instrument would have reported it either as a bare fact about grants or,
-- worse, as a pass. has_column_privilege() composes table-level and
-- column-level and answers the question actually being asked: may this role
-- write this column. bool_or over the column list keeps it to one row.
union all select 'governance columns not directly writable',
       (not bool_or(has_column_privilege('authenticated', 'public.work_orders', c, 'UPDATE')))::text
       from unnest(array['stage','status','approved_at','approved_by','risk_tier','remediation_rounds']) as c
union all select 'seq not caller-settable',
       (not bool_or(has_column_privilege('authenticated', 'public.work_order_events', c, 'INSERT')))::text
       from unnest(array['seq','created_by','created_by_email','created_at']) as c
union all select 'agent_gates read-only (1 policy)',
       -- Asserts the CURRENT state, which is the gap: there is no write policy.
       -- If a write policy is ever added this flips to false on purpose.
       (count(*) = 1)::text from pg_policy where polrelid = 'public.agent_gates'::regclass
union all select 'D3 refused by CHECK constraint',
       (count(*) = 1)::text from pg_constraint where conname = 'work_orders_no_d3'
union all select 'wo_code unique',
       (count(*) = 1)::text from pg_indexes where schemaname = 'public' and indexname = 'work_orders_wo_code_key'
union all select 'remediation bounded at 3',
       (count(*) = 1)::text from pg_constraint where conname = 'work_orders_remediation_bound'
union all select 'event author stamped by trigger',
       (count(*) = 1)::text from pg_trigger where tgname = 'work_order_events_stamp'
union all select 'ingest guard protects library rows',
       (count(*) = 1)::text from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'ingest_agents'
         and position('''library''' in pg_get_functiondef(oid)) > 0
union all select 'approval requires aal2',
       (count(*) = 1)::text from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'approve_work_order'
         and position('aal2' in pg_get_functiondef(oid)) > 0
union all select 'adjudicate cannot skip to approve',
       (count(*) = 1)::text from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'advance_work_order'
         and position('when ''adjudicate'' then array[''remediate'', ''blocked'']' in pg_get_functiondef(oid)) > 0
union all select 'no unbounded validate->execute loop',
       (count(*) = 1)::text from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'advance_work_order'
         and position('when ''validate''   then array[''evaluate'', ''remediate'', ''blocked'']' in pg_get_functiondef(oid)) > 0
union all select 'change_log entry recorded once',
       (count(*) = 1)::text from public.change_log where source_ref = 'migration:0018_agent_library';
