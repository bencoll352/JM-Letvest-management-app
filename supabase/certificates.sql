create or replace function public.jm_letvest_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'address',p.address,'city',p.city,'postcode',p.postcode,'council',p.council,'image',p.image,'certificates',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'expires',expires_on)) from jm_letvest.certificates where property_id=p.id),'[]'::jsonb),
 'rooms',(select count(*) from jm_letvest.rooms r where r.property_id=p.id),
 'occupied',(select count(*) from jm_letvest.sub_leases s join jm_letvest.rooms r on r.id=s.room_id where r.property_id=p.id and current_date>=s.starts_on and current_date<s.ends_on),
 'roomRent',coalesce((select avg(s.monthly_rent) from jm_letvest.sub_leases s join jm_letvest.rooms r on r.id=s.room_id where r.property_id=p.id and current_date>=s.starts_on and current_date<s.ends_on),(select avg(advertised_rent) from jm_letvest.rooms r where r.property_id=p.id),0),
 'headRent',pnl.head_rent,'expenses',pnl.expenses,
 'landlord',coalesce((select c.name from jm_letvest.master_leases m join jm_letvest.contacts c on c.id=m.landlord_id where m.property_id=p.id order by m.ends_on desc limit 1),''),
 'leaseEnd',coalesce((select max(ends_on) from jm_letvest.master_leases where property_id=p.id),current_date),
 'compliance',coalesce((select expires_on from jm_letvest.certificates where property_id=p.id and kind='CP12'),current_date)
 )) from jm_letvest.properties p join jm_letvest.property_pnl pnl on pnl.id=p.id),'[]'::jsonb),
 'deals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'address',address,'landlord',contact_name,'value',potential_spread,'rooms',rooms,'stage',stage)) from jm_letvest.deals),'[]'::jsonb),
 'tickets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'propertyId',t.property_id,'room',t.room,'priority',t.priority,'status',t.status,'contractor',coalesce(c.name,''),'created',t.created_at::date,'description',t.description,'photo',t.photo) order by t.created_at desc) from jm_letvest.maintenance_tickets t left join jm_letvest.contractors c on c.id=t.contractor_id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',c.name,'propertyId',r.property_id,'room',r.name,'amount',p.amount,'due',p.due_on,'paid',p.paid_at is not null)) from jm_letvest.rent_payments p join jm_letvest.sub_leases s on s.id=p.sub_lease_id join jm_letvest.contacts c on c.id=s.occupant_id join jm_letvest.rooms r on r.id=s.room_id),'[]'::jsonb)
); $$;
create function public.jm_letvest_certificate(property_id text,certificate_kind text,expiry date) returns void language plpgsql security invoker set search_path='' as $$
declare w uuid; begin
if auth.uid() is null then raise exception 'Sign in required'; end if;
select p.workspace_id into w from jm_letvest.properties p join jm_letvest.workspaces ws on ws.id=p.workspace_id where p.id=property_id and ws.owner_id=auth.uid();
if w is null then raise exception 'Manager access required'; end if;
insert into jm_letvest.certificates(workspace_id,property_id,kind,expires_on) values(w,property_id,certificate_kind,expiry)
on conflict on constraint certificates_property_id_kind_key do update set expires_on=excluded.expires_on;
end; $$;
revoke all on function public.jm_letvest_certificate(text,text,date) from public,anon;
grant execute on function public.jm_letvest_certificate(text,text,date) to authenticated;
