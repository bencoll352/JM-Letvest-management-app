-- All test data is rolled back, including the temporary Auth identity.
begin;
insert into auth.users(id,aud,role,email) values('11111111-1111-4111-a111-111111111111','authenticated','authenticated','jm-test@example.invalid');
insert into auth.users(id,aud,role,email) values('33333333-3333-4333-a333-333333333333','authenticated','authenticated','jm-resident@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',true);
select public.jm_letvest_create_workspace();
select public.jm_letvest_mutate('property','{"id":"jm-test-property","address":"Test HMO","city":"Southampton","postcode":"SO14 1AA","council":"Southampton","image":"sample","landlord":"Test Landlord","headRent":2000,"expenses":500,"leaseEnd":"2030-01-01","compliance":"2027-01-01","rooms":5,"occupied":4,"roomRent":750}'::jsonb);
do $$ declare n numeric; begin
select revenue-head_rent-expenses into n from jm_letvest.property_pnl;
if n<>500 then raise exception 'P&L assertion failed'; end if;
begin
insert into jm_letvest.sub_leases(workspace_id,room_id,master_lease_id,occupant_id,monthly_rent,starts_on,ends_on)
select workspace_id,room_id,master_lease_id,occupant_id,monthly_rent,starts_on,ends_on from jm_letvest.sub_leases limit 1;
raise exception 'Overlapping occupancy was incorrectly accepted';
exception when exclusion_violation then null; end;
end $$;
update jm_letvest.contacts set user_id='33333333-3333-4333-a333-333333333333' where id=(select occupant_id from jm_letvest.sub_leases limit 1);
select public.jm_letvest_certificate('jm-test-property','EICR',current_date+10);
select set_config('request.jwt.claim.sub','33333333-3333-4333-a333-333333333333',true);
select public.jm_letvest_report_fault('{"id":"resident-test-ticket","propertyId":"jm-test-property","room":"Room 1","title":"Test fault","description":"Rollback-only test","priority":"Routine"}'::jsonb);
do $$ declare updated integer; begin
if not exists(select 1 from jm_letvest.properties where id='jm-test-property') then raise exception 'Resident cannot access leased property'; end if;
if exists(select 1 from jm_letvest.master_leases) then raise exception 'Resident can see private head lease'; end if;
update jm_letvest.maintenance_tickets set status='Resolved' where id='resident-test-ticket';
get diagnostics updated=row_count;
if updated<>0 then raise exception 'Resident can dispatch/update tickets'; end if;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-a222-222222222222',true);
do $$ begin
if exists(select 1 from jm_letvest.properties) then raise exception 'RLS isolation failed'; end if;
if public.jm_letvest_snapshot()->'properties'<>'[]'::jsonb then raise exception 'Snapshot isolation failed'; end if;
end $$;
rollback;
select 'PASS: spread, overlap rejection, certificate update, resident fault reporting, resident write restrictions and user isolation' as test_result;
