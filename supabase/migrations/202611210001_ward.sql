begin;
create type public.ll_status as enum ('awaiting_review','assigned','under_repair','repaired');
create sequence public.ll_display_seq start with 1044;
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 display_id text not null unique default ('LL-'||nextval('public.ll_display_seq')::text),
 tracking_token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
 description text not null check(length(description) between 1 and 3000),
 language text not null check(language in ('hi','en')),
 landmark text not null check(length(landmark) between 1 and 200),
 lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 photo_path text,
 category text not null default 'other' check(category in ('other','road_damage','water_leak')),
 severity text check(severity in ('low','medium','high')),
 severity_reason text,
 routed_to text not null default 'Ward Help Desk (simulated)',
 incident_id uuid,
 submitted_at timestamptz not null default now()
);
create table public.incidents (
 id uuid primary key default gen_random_uuid(),
 lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 representative_report_id uuid not null unique references public.reports(id),
 repair_status public.ll_status not null default 'assigned',
 created_at timestamptz not null default now()
);
alter table public.reports add foreign key(incident_id) references public.incidents;
create index ll_reports_incident on public.reports(incident_id);
create table public.match_reviews (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.reports,
 candidate_incident_id uuid not null references public.incidents,
 verdict text not null check(verdict in ('likely_same','uncertain','likely_different')),
 summary_en text not null, supporting jsonb not null default '[]', conflicting jsonb not null default '[]',
 officer_decision text not null default 'pending' check(officer_decision in ('linked','separate','pending')),
 model_error text, created_at timestamptz not null default now(),
 unique(report_id,candidate_incident_id)
);
create table public.repair_updates (
 id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.incidents,
 status public.ll_status not null,public_note text not null check(length(public_note)<=1000),
 created_at timestamptz not null default clock_timestamp()
);
create index ll_latest_update on public.repair_updates(incident_id,created_at desc);

alter table public.reports enable row level security;
alter table public.incidents enable row level security;
alter table public.match_reviews enable row level security;
alter table public.repair_updates enable row level security;
revoke all on public.reports,public.incidents,public.match_reviews,public.repair_updates from public,anon,authenticated;
revoke all on public.ll_display_seq from public,anon,authenticated;
grant select,insert,update,delete on public.reports,public.incidents,public.match_reviews,public.repair_updates to service_role;
grant usage on public.ll_display_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('report-photos','report-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.ll_snapshot() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'reports',coalesce((select jsonb_agg(r order by r.submitted_at desc) from reports r),'[]'),
 'incidents',coalesce((select jsonb_agg(i order by i.created_at desc) from incidents i),'[]'),
 'reviews',coalesce((select jsonb_agg(m order by m.created_at desc) from match_reviews m),'[]'),
 'updates',coalesce((select jsonb_agg(u order by u.created_at desc,u.id desc) from repair_updates u),'[]'))
$$;

create function public.ll_analysis(rid uuid,triage jsonb,items jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare linked_id uuid; item jsonb; target uuid;
begin
 update reports set category=triage->>'category',severity=triage->>'severity',
 severity_reason=triage->>'severity_reason',routed_to=triage->>'routed_to' where id=rid returning incident_id into linked_id;
 if not found then raise no_data_found; end if;
 for item in select value from jsonb_array_elements(items) loop
   target:=(item->>'candidate_incident_id')::uuid;
   insert into match_reviews(report_id,candidate_incident_id,summary_en,verdict,supporting,conflicting,model_error,officer_decision)
    values(rid,target,item->>'summary_en',item->>'verdict',item->'supporting',item->'conflicting',item->>'model_error',
     case when linked_id is null then 'pending' when linked_id=target then 'linked' else 'separate' end)
    on conflict(report_id,candidate_incident_id) do update set summary_en=excluded.summary_en,verdict=excluded.verdict,
    supporting=excluded.supporting,conflicting=excluded.conflicting,model_error=excluded.model_error,
    officer_decision=case when match_reviews.officer_decision='pending' then excluded.officer_decision else match_reviews.officer_decision end;
 end loop;
end $$;

create function public.ll_decide(rid uuid,choice text,cid uuid default null) returns void language plpgsql security invoker set search_path=public as $$
declare r reports%rowtype; i incidents%rowtype; chosen uuid;
begin
 select * into strict r from reports where id=rid for update;
 if r.incident_id is not null then
   select * into strict i from incidents where id=r.incident_id;
   if (choice='linked' and r.incident_id=cid) or (choice='separate' and i.representative_report_id=rid) then return;end if;
   raise exception 'Already assigned';
 end if;
 if choice='pending' then return; end if;
 if cid is not null then select * into strict i from incidents where id=cid for update; end if;
 if choice='linked' then
   if cid is null or i.repair_status='repaired' then raise exception 'Existing open incident required';end if;
   chosen:=cid;
 elsif choice='separate' then
   insert into incidents(lat,lng,representative_report_id) values (r.lat,r.lng,rid) returning id into chosen;
 else raise exception 'Unknown decision';
 end if;
 update reports set incident_id=chosen where id=rid;
 if cid is not null then
  insert into match_reviews(report_id,candidate_incident_id,summary_en,verdict)
  values(rid,cid,'Manual officer review.','uncertain') on conflict(report_id,candidate_incident_id) do nothing;
 end if;
 update match_reviews set officer_decision=case when candidate_incident_id=chosen then 'linked' else 'separate' end where report_id=rid;
end $$;

create function public.ll_repair(cid uuid,new_status public.ll_status,note text) returns void language plpgsql security invoker set search_path=public as $$
declare current_status ll_status; last_update repair_updates%rowtype;
begin
 select repair_status into strict current_status from incidents where id=cid for update;
 select * into last_update from repair_updates where incident_id=cid order by created_at desc,id desc limit 1;
 if current_status=new_status and last_update.status=new_status and last_update.public_note=note then return; end if;
 update incidents set repair_status=new_status where id=cid;
 insert into repair_updates(incident_id,status,public_note) values(cid,new_status,note);
end $$;

create function public.ll_track(token text) returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('status',coalesce(i.repair_status,'awaiting_review'),
 'public_note',(select u.public_note from repair_updates u where u.incident_id=i.id order by u.created_at desc,u.id desc limit 1))
 from reports r left join incidents i on i.id=r.incident_id where r.tracking_token=token
$$;
create function public.ll_dashboard() returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'open',(select count(*) from incidents where repair_status<>'repaired'),
 'repaired',(select count(*) from incidents where repair_status='repaired'),
 'incidents',coalesce((select jsonb_agg(jsonb_build_object('id',id,'lat',round(lat::numeric,4),'lng',round(lng::numeric,4),'repair_status',repair_status)) from incidents),'[]'),
 'fixes',coalesce((select jsonb_agg(jsonb_build_object('status',f.status,'public_note',f.public_note,'created_at',f.created_at) order by f.created_at desc)
  from (select u.status,u.public_note,u.created_at from incidents i cross join lateral
   (select status,public_note,created_at from repair_updates where incident_id=i.id and status='repaired' order by created_at desc,id desc limit 1) u
   where i.repair_status='repaired' order by u.created_at desc limit 10) f),'[]'))
$$;
-- Functions are service-role-only; the public-facing projection is served by Next.js.
revoke all on function public.ll_snapshot(),public.ll_analysis(uuid,jsonb,jsonb),public.ll_decide(uuid,text,uuid),
 public.ll_repair(uuid,public.ll_status,text),public.ll_track(text),public.ll_dashboard() from public,anon,authenticated;
grant execute on function public.ll_snapshot(),public.ll_analysis(uuid,jsonb,jsonb),public.ll_decide(uuid,text,uuid),
 public.ll_repair(uuid,public.ll_status,text),public.ll_track(text),public.ll_dashboard() to service_role;
commit;
