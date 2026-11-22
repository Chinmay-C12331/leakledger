-- Rerunning the seed preserves existing private tokens, review decisions and repair status.
begin;
insert into public.reports(display_id,description,language,landmark,lat,lng,category,severity,severity_reason,routed_to,submitted_at) values
 ('LL-1041','The pipe behind the tea stall is leaking into the lane beside the counter.','en','Tea stall',12.92949,77.58238,'water_leak','medium','A resident describes an active pipe leak.','Water Supply Dept. (simulated)','2026-11-21T03:24:00Z'),
 ('LL-1042','Water is flowing from the pipe joint just outside the blue school gate.','en','Blue school gate',12.9290,77.5820,'water_leak','medium','A resident describes an active pipe leak.','Water Supply Dept. (simulated)','2026-11-21T03:46:00Z'),
 ('LL-1043','स्कूल के नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।','hi','Blue school gate',12.92904,77.58203,'water_leak','medium','A resident describes an active pipe leak.','Water Supply Dept. (simulated)','2026-11-21T04:12:00Z')
 on conflict(display_id) do nothing;
-- Bundled staged photo, served through the authenticated photo route.
update public.reports set photo_path='fixtures/school-gate.jpg' where display_id='LL-1042' and photo_path is null;
insert into public.incidents(lat,lng,representative_report_id,created_at)
 select lat,lng,id,submitted_at from public.reports where display_id in ('LL-1041','LL-1042') on conflict(representative_report_id) do nothing;
update public.reports r set incident_id=i.id from public.incidents i where r.id=i.representative_report_id and r.display_id in ('LL-1041','LL-1042') and r.incident_id is null;
insert into public.match_reviews(report_id,candidate_incident_id,summary_en,verdict,supporting,conflicting,officer_decision)
 select r.id,c.incident_id,'Water is leaking from a pipe joint near the blue school gate.',
 case when c.display_id='LL-1042' then 'likely_same' else 'likely_different' end,
 case when c.display_id='LL-1042' then '[{"source":"landmark","detail":"Both reports identify the blue school gate."},{"source":"text","detail":"Both residents describe a leaking pipe joint."}]'::jsonb else '[]'::jsonb end,
 case when c.display_id='LL-1041' then '[{"source":"landmark","detail":"One report identifies the school gate and the other the tea stall."}]'::jsonb else '[]'::jsonb end,
 case when r.incident_id is null then 'pending' when r.incident_id=c.incident_id then 'linked' else 'separate' end
 from public.reports r cross join public.reports c where r.display_id='LL-1043' and c.display_id in ('LL-1041','LL-1042')
 on conflict(report_id,candidate_incident_id) do nothing;
commit;
