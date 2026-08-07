-- Diagnostic for the two `false` rows in 0018_VERIFY.sql:
--   governance columns not directly writable  -> false
--   seq not caller-settable                   -> false
--
-- THE QUESTION. 0018 protects those columns with column-level REVOKEs
-- (lines 295 and 525). In PostgreSQL a column-level REVOKE does NOT cut
-- into a TABLE-level GRANT: if `authenticated` holds UPDATE on the whole
-- table, revoking individual columns is inert and the columns stay
-- writable. Supabase grants table-wide privileges to `authenticated` by
-- default, and no migration in this repo grants or revokes them, so that
-- collision is live rather than theoretical.
--
-- WHY VERIFY COULD NOT ANSWER IT. Those two checks read
-- information_schema.column_privileges, which reports grants, not the
-- effective answer to "may this role write this column". has_column_privilege()
-- composes table-level and column-level grants and returns the real answer.
-- That is the instrument this file uses.
--
-- HOW TO READ THE RESULT.
--   Rows 3-10 all FALSE  -> the revokes worked. The columns are protected
--                           and the two VERIFY rows are false positives;
--                           VERIFY needs fixing, the database does not.
--   Rows 3-10 all TRUE   -> the revokes bounced off a table-level grant.
--                           The columns are writable through PostgREST with
--                           the browser key, which is exactly the attack
--                           0018's own comment describes: set stage='release',
--                           stamp approved_at with any email, reopen a closed
--                           work order, and write nothing to the event feed.
--   Row 11 (the control) should be TRUE either way. It proves `authenticated`
--   can update this table at all — so a FALSE on rows 3-8 means the revoke
--   bit, rather than the role simply having no access to anything.

select 'TABLE-level UPDATE on work_orders'        as check,
       has_table_privilege('authenticated','public.work_orders','UPDATE')::text as result
union all select 'TABLE-level INSERT on work_order_events',
       has_table_privilege('authenticated','public.work_order_events','INSERT')::text

union all select 'authenticated may UPDATE work_orders.stage',
       has_column_privilege('authenticated','public.work_orders','stage','UPDATE')::text
union all select 'authenticated may UPDATE work_orders.status',
       has_column_privilege('authenticated','public.work_orders','status','UPDATE')::text
union all select 'authenticated may UPDATE work_orders.approved_at',
       has_column_privilege('authenticated','public.work_orders','approved_at','UPDATE')::text
union all select 'authenticated may UPDATE work_orders.approved_by',
       has_column_privilege('authenticated','public.work_orders','approved_by','UPDATE')::text
union all select 'authenticated may UPDATE work_orders.risk_tier',
       has_column_privilege('authenticated','public.work_orders','risk_tier','UPDATE')::text
union all select 'authenticated may UPDATE work_orders.remediation_rounds',
       has_column_privilege('authenticated','public.work_orders','remediation_rounds','UPDATE')::text

union all select 'authenticated may INSERT work_order_events.seq',
       has_column_privilege('authenticated','public.work_order_events','seq','INSERT')::text
union all select 'authenticated may INSERT work_order_events.created_by_email',
       has_column_privilege('authenticated','public.work_order_events','created_by_email','INSERT')::text

union all select 'CONTROL: authenticated may UPDATE work_orders.title (expect true)',
       has_column_privilege('authenticated','public.work_orders','title','UPDATE')::text

union all select 'raw ACL on work_orders',
       coalesce(array_to_string(relacl,'  |  '),'(none — owner defaults only)')
       from pg_class where oid = 'public.work_orders'::regclass
union all select 'raw ACL on work_order_events',
       coalesce(array_to_string(relacl,'  |  '),'(none — owner defaults only)')
       from pg_class where oid = 'public.work_order_events'::regclass;
