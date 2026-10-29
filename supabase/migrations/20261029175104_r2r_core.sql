-- JM Letvest uses an isolated schema. Public RPCs are SECURITY INVOKER;
-- they retain authenticated-user RLS and never use service-role credentials.
create schema if not exists jm_letvest;
grant usage on schema jm_letvest to authenticated;
create table jm_letvest.workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null default 'JM Letvest Ltd', created_at timestamptz not null default now()
);
create index jm_workspace_owner on jm_letvest.workspaces(owner_id);
create table jm_letvest.contacts (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null references jm_letvest.workspaces(id),
 name text not null, kind text not null check(kind in ('landlord','occupant','corporate')), email text, phone text,
 user_id uuid references auth.users(id), unique(workspace_id,id)
);
create table jm_letvest.properties (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null references jm_letvest.workspaces(id),
 address text not null, city text not null, postcode text not null, council text not null,
 licensing_type text not null default 'Mandatory HMO' check(licensing_type in ('Selective','Additional','Mandatory HMO','Not required')),
 image text not null default 'photo-1600585154340-be6161a56a0c', unique(workspace_id,id)
);
create table jm_letvest.rooms (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, property_id text not null, name text not null,
 advertised_rent numeric(12,2) not null check(advertised_rent>=0), unique(workspace_id,id), unique(property_id,name),
 foreign key(workspace_id,property_id) references jm_letvest.properties(workspace_id,id)
);
create table jm_letvest.master_leases (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, property_id text not null,
 landlord_id text not null, monthly_rent numeric(12,2) not null check(monthly_rent>=0), starts_on date not null,
 ends_on date not null, break_clause text, insurance_requirements text, check(ends_on>starts_on),
 unique(workspace_id,id), foreign key(workspace_id,property_id) references jm_letvest.properties(workspace_id,id),
 foreign key(workspace_id,landlord_id) references jm_letvest.contacts(workspace_id,id)
);
create table jm_letvest.sub_leases (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, room_id text not null, master_lease_id text not null,
 occupant_id text not null, monthly_rent numeric(12,2) not null check(monthly_rent>=0), starts_on date not null, ends_on date not null,
 agreement_type text not null default 'Pending legal classification', deposit_scheme text check(deposit_scheme in ('DPS','TDS','MyDeposits','Not applicable')),
 deposit_reference text, check(ends_on>starts_on), foreign key(workspace_id,room_id) references jm_letvest.rooms(workspace_id,id),
 foreign key(workspace_id,master_lease_id) references jm_letvest.master_leases(workspace_id,id), foreign key(workspace_id,occupant_id) references jm_letvest.contacts(workspace_id,id), unique(workspace_id,id)
);
-- Prevent overlapping room agreements, including racing inserts.
create extension if not exists btree_gist with schema extensions;
alter table jm_letvest.sub_leases add constraint jm_no_overlapping_occupancy exclude using gist (room_id with =, daterange(starts_on,ends_on,'[)') with &&);
create table jm_letvest.certificates (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, property_id text not null,
 kind text not null check(kind in ('CP12','EICR','PAT','EPC','HMO Licence')), expires_on date not null, document_path text,
 foreign key(workspace_id,property_id) references jm_letvest.properties(workspace_id,id), unique(property_id,kind)
);
create table jm_letvest.contractors (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null references jm_letvest.workspaces(id),
 name text not null, trade text not null, phone text, vetting_reference text, insurance_expires_on date, unique(workspace_id,id)
);
create table jm_letvest.maintenance_tickets (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, property_id text not null,
 reporter_id uuid references auth.users(id), room text not null, title text not null, description text not null,
 priority text not null check(priority in ('Emergency','Urgent','Routine')), status text not null default 'Open' check(status in ('Open','Assigned','In Progress','Resolved')),
 contractor_id text, photo text, created_at timestamptz not null default now(),
 check(status not in ('Assigned','In Progress') or contractor_id is not null),
 foreign key(workspace_id,property_id) references jm_letvest.properties(workspace_id,id),
 foreign key(workspace_id,contractor_id) references jm_letvest.contractors(workspace_id,id)
);
create table jm_letvest.expenses (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, property_id text not null,
 category text not null, monthly_amount numeric(12,2) not null check(monthly_amount>=0),
 foreign key(workspace_id,property_id) references jm_letvest.properties(workspace_id,id)
);
create table jm_letvest.rent_payments (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null, sub_lease_id text not null,
 due_on date not null, amount numeric(12,2) not null check(amount>0), paid_at timestamptz,
 foreign key(workspace_id,sub_lease_id) references jm_letvest.sub_leases(workspace_id,id), unique(sub_lease_id,due_on)
);
create table jm_letvest.deals (
 id text primary key default gen_random_uuid()::text, workspace_id uuid not null references jm_letvest.workspaces(id),
 address text not null, contact_name text not null, rooms integer not null check(rooms>0),
 potential_spread numeric(12,2) not null check(potential_spread>=0), stage integer not null default 0 check(stage between 0 and 4)
);
alter table jm_letvest.workspaces enable row level security;
create policy jm_workspace_owner on jm_letvest.workspaces for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
do $$ declare t text; begin
 foreach t in array array['contacts','properties','rooms','master_leases','sub_leases','certificates','contractors','maintenance_tickets','expenses','rent_payments','deals'] loop
 execute format('alter table jm_letvest.%I enable row level security',t);
 execute format('create policy jm_owner on jm_letvest.%I for all to authenticated using (workspace_id in (select id from jm_letvest.workspaces)) with check (workspace_id in (select id from jm_letvest.workspaces))',t);
 execute format('create index on jm_letvest.%I(workspace_id)',t);
 end loop;
end $$;
grant select,insert,update,delete on all tables in schema jm_letvest to authenticated;
-- Occupants can see only their contact, agreements, rooms and submitted tickets.
create policy jm_resident_contact on jm_letvest.contacts for select to authenticated using(user_id=(select auth.uid()));
create policy jm_resident_lease on jm_letvest.sub_leases for select to authenticated using(occupant_id in(select id from jm_letvest.contacts where user_id=(select auth.uid())));
create policy jm_resident_room on jm_letvest.rooms for select to authenticated using(id in(select room_id from jm_letvest.sub_leases where occupant_id in(select id from jm_letvest.contacts where user_id=(select auth.uid()))));
create policy jm_resident_read_ticket on jm_letvest.maintenance_tickets for select to authenticated using(reporter_id=(select auth.uid()));
create policy jm_resident_report on jm_letvest.maintenance_tickets for insert to authenticated with check(
 reporter_id=(select auth.uid()) and status='Open' and contractor_id is null and exists(
 select 1 from jm_letvest.sub_leases s join jm_letvest.rooms r on r.id=s.room_id
 join jm_letvest.contacts c on c.id=s.occupant_id where c.user_id=(select auth.uid()) and r.property_id=maintenance_tickets.property_id
 and r.workspace_id=maintenance_tickets.workspace_id and current_date>=s.starts_on and current_date<s.ends_on));
create view jm_letvest.property_pnl with(security_invoker=true) as
 select p.id,p.workspace_id,p.address,
 coalesce((select sum(s.monthly_rent) from jm_letvest.sub_leases s join jm_letvest.rooms r on r.id=s.room_id where r.property_id=p.id and current_date>=s.starts_on and current_date<s.ends_on),0) revenue,
 coalesce((select sum(m.monthly_rent) from jm_letvest.master_leases m where m.property_id=p.id and current_date>=m.starts_on and current_date<m.ends_on),0) head_rent,
 coalesce((select sum(e.monthly_amount) from jm_letvest.expenses e where e.property_id=p.id),0) expenses
 from jm_letvest.properties p;
grant select on jm_letvest.property_pnl to authenticated;
create function public.jm_letvest_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'address',p.address,'city',p.city,'postcode',p.postcode,'council',p.council,'image',p.image,
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
create function public.jm_letvest_create_workspace() returns uuid language plpgsql security invoker set search_path='' as $$
declare w uuid; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select id into w from jm_letvest.workspaces limit 1;
 if w is null then insert into jm_letvest.workspaces(owner_id) values(auth.uid()) returning id into w; end if;
 return w;
end; $$;
-- Narrow RPC operations use typed casts, checked constraints and RLS.
create function public.jm_letvest_mutate(operation text, payload jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare w uuid; p text; c text; m text; r text; i integer; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select id into w from jm_letvest.workspaces limit 1;
 if w is null then raise exception 'Create a JM Letvest workspace first'; end if;
 if operation='property' then
 if (payload->>'occupied')::int>(payload->>'rooms')::int then raise exception 'Occupied rooms exceed room count'; end if;
 insert into jm_letvest.contacts(workspace_id,name,kind) values(w,payload->>'landlord','landlord') returning id into c;
 insert into jm_letvest.properties(id,workspace_id,address,city,postcode,council,image) values(payload->>'id',w,payload->>'address',payload->>'city',payload->>'postcode',payload->>'council',payload->>'image') returning id into p;
 insert into jm_letvest.master_leases(workspace_id,property_id,landlord_id,monthly_rent,starts_on,ends_on) values(w,p,c,(payload->>'headRent')::numeric,current_date,(payload->>'leaseEnd')::date) returning id into m;
 insert into jm_letvest.expenses(workspace_id,property_id,category,monthly_amount) values(w,p,'Operating budget',(payload->>'expenses')::numeric);
 insert into jm_letvest.certificates(workspace_id,property_id,kind,expires_on) values(w,p,'CP12',(payload->>'compliance')::date);
 for i in 1..(payload->>'rooms')::int loop
 insert into jm_letvest.rooms(workspace_id,property_id,name,advertised_rent) values(w,p,'Room '||i,(payload->>'roomRent')::numeric) returning id into r;
 if i<=(payload->>'occupied')::int then
 insert into jm_letvest.contacts(workspace_id,name,kind) values(w,'Occupant details pending · Room '||i,'occupant') returning id into c;
 insert into jm_letvest.sub_leases(workspace_id,room_id,master_lease_id,occupant_id,monthly_rent,starts_on,ends_on) values(w,r,m,c,(payload->>'roomRent')::numeric,current_date,(payload->>'leaseEnd')::date);
 end if; end loop;
 elsif operation='deal' then
 insert into jm_letvest.deals(id,workspace_id,address,contact_name,rooms,potential_spread,stage) values(payload->>'id',w,payload->>'address',payload->>'landlord',(payload->>'rooms')::int,(payload->>'value')::numeric,(payload->>'stage')::int)
 on conflict(id) do update set stage=excluded.stage;
 elsif operation='ticket' then
 select id into c from jm_letvest.contractors where workspace_id=w and name=payload->>'contractor' limit 1;
 if c is null and coalesce(payload->>'contractor','')<>'' then insert into jm_letvest.contractors(workspace_id,name,trade) values(w,payload->>'contractor','Verification pending') returning id into c; end if;
 insert into jm_letvest.maintenance_tickets(id,workspace_id,property_id,reporter_id,room,title,description,priority,status,contractor_id,photo)
 values(payload->>'id',w,payload->>'propertyId',auth.uid(),payload->>'room',payload->>'title',payload->>'description',payload->>'priority',payload->>'status',c,payload->>'photo')
 on conflict(id) do update set status=excluded.status,contractor_id=excluded.contractor_id;
 elsif operation='payment' then
 update jm_letvest.rent_payments set paid_at=case when (payload->>'paid')::boolean then now() else null end where id=payload->>'id' and workspace_id=w;
 else raise exception 'Unsupported operation'; end if;
end; $$;
revoke all on function public.jm_letvest_snapshot(),public.jm_letvest_create_workspace(),public.jm_letvest_mutate(text,jsonb) from public,anon;
grant execute on function public.jm_letvest_snapshot(),public.jm_letvest_create_workspace(),public.jm_letvest_mutate(text,jsonb) to authenticated;
-- Foreign-key lookup indexes (workspace indexes are created above).
create index on jm_letvest.rooms(property_id);
create index on jm_letvest.master_leases(property_id);
create index on jm_letvest.master_leases(landlord_id);
create index on jm_letvest.sub_leases(room_id);
create index on jm_letvest.sub_leases(master_lease_id);
create index on jm_letvest.sub_leases(occupant_id);
create index on jm_letvest.maintenance_tickets(property_id);
create index on jm_letvest.maintenance_tickets(contractor_id);
create index on jm_letvest.rent_payments(sub_lease_id);
create index on jm_letvest.expenses(property_id);
create index on jm_letvest.contacts(user_id);
