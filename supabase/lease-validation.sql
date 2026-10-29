create function jm_letvest.validate_sublease() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from jm_letvest.rooms r join jm_letvest.master_leases m on m.property_id=r.property_id and m.workspace_id=r.workspace_id
 where r.id=new.room_id and m.id=new.master_lease_id and r.workspace_id=new.workspace_id and new.starts_on>=m.starts_on and new.ends_on<=m.ends_on)
 then raise exception 'Room agreement must match the property and dates of its head lease'; end if;
 return new;
end; $$;
create trigger jm_sublease_validate before insert or update on jm_letvest.sub_leases for each row execute function jm_letvest.validate_sublease();
alter table jm_letvest.master_leases add constraint jm_no_overlapping_headlease exclude using gist(property_id with =,daterange(starts_on,ends_on,'[)') with &&);
-- Updating a master lease cannot orphan an existing room agreement.
create function jm_letvest.validate_masterlease() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from jm_letvest.sub_leases s join jm_letvest.rooms r on r.id=s.room_id where s.master_lease_id=new.id and (s.starts_on<new.starts_on or s.ends_on>new.ends_on or r.property_id<>new.property_id))
 then raise exception 'Head lease change would invalidate a room agreement'; end if;
 return new;
end; $$;
create trigger jm_masterlease_validate before update on jm_letvest.master_leases for each row execute function jm_letvest.validate_masterlease();
revoke all on function jm_letvest.validate_sublease(),jm_letvest.validate_masterlease() from public,anon;
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
