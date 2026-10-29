create policy jm_resident_property on jm_letvest.properties for select to authenticated using(
 id in(select r.property_id from jm_letvest.rooms r join jm_letvest.sub_leases s on s.room_id=r.id join jm_letvest.contacts c on c.id=s.occupant_id
 where c.user_id=(select auth.uid()) and current_date>=s.starts_on and current_date<s.ends_on));
alter table jm_letvest.maintenance_tickets add constraint jm_photo_limit check(photo is null or length(photo)<=2100000);
create function public.jm_letvest_report_fault(payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w uuid; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select workspace_id into w from jm_letvest.properties where id=payload->>'propertyId';
 if w is null then raise exception 'Property access denied'; end if;
 insert into jm_letvest.maintenance_tickets(id,workspace_id,property_id,reporter_id,room,title,description,priority,status,photo)
 values(payload->>'id',w,payload->>'propertyId',auth.uid(),payload->>'room',payload->>'title',payload->>'description',payload->>'priority','Open',payload->>'photo');
end; $$;
revoke all on function public.jm_letvest_report_fault(jsonb) from public,anon;
grant execute on function public.jm_letvest_report_fault(jsonb) to authenticated;
