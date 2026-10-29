-- Run with an authenticated manager JWT through the SQL API, or in a
-- transaction with request.jwt.claim.sub set to YOUR existing Auth user ID.
-- Do not run as an unauthenticated postgres session: auth.uid() is required.
select public.jm_letvest_create_workspace();
do $$ declare p text:=gen_random_uuid()::text; w uuid; s text; begin
 select id into w from jm_letvest.workspaces where owner_id=auth.uid() limit 1;
 if w is null then raise exception 'Sign in as a manager before seeding'; end if;
 perform public.jm_letvest_mutate('property',jsonb_build_object('id',p,'address','24 Oxford Road','city','Southampton','postcode','SO14 6QZ','council','Southampton City Council','image','photo-1600585154340-be6161a56a0c','landlord','James Whitmore','rooms',6,'occupied',6,'roomRent',725,'headRent',2400,'expenses',650,'compliance',current_date+14,'leaseEnd',current_date+1095));
 perform public.jm_letvest_mutate('ticket',jsonb_build_object('id',gen_random_uuid()::text,'title','Boiler losing pressure','propertyId',p,'room','Communal','description','Pressure drops overnight. Sample maintenance request.','priority','Urgent','status','Open','contractor',''));
 perform public.jm_letvest_mutate('deal',jsonb_build_object('id',gen_random_uuid()::text,'address','31 Shirley Road','landlord','Peter Wilson','rooms',6,'value',1250,'stage',0));
 select sl.id into s from jm_letvest.sub_leases sl join jm_letvest.rooms r on r.id=sl.room_id where r.property_id=p limit 1;
 insert into jm_letvest.rent_payments(workspace_id,sub_lease_id,due_on,amount) values(w,s,current_date-5,725);
end $$;
