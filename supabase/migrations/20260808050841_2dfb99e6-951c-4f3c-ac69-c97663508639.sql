DO $$
DECLARE
  org uuid; org2 uuid;
  t_north uuid; t_west uuid;
  m_owner uuid; m_mgr uuid; m_rahul uuid; m_priya uuid; m_acct uuid;
  s_new uuid; s_cont uuid; s_qual uuid; s_prop uuid; s_neg uuid; s_won uuid; s_lost uuid;
  src_web uuid; src_ref uuid; src_ads uuid; src_cold uuid; src_exh uuid; src_wa uuid;
  st_qual uuid; st_disc uuid; st_prop uuid; st_neg uuid; st_won uuid; st_lost uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; d6 uuid; d7 uuid; d8 uuid; d9 uuid; d10 uuid;
  i1 uuid; i2 uuid; i3 uuid; i4 uuid; i5 uuid; i6 uuid;
  q1 uuid; q2 uuid;
  l9 uuid; l2 uuid; l5 uuid; l18 uuid;
  plan_pro uuid; plan_free uuid;
  o2m uuid; o2s uuid; o2st uuid;
BEGIN
  SELECT id INTO plan_pro FROM public.plans WHERE code='professional';
  SELECT id INTO plan_free FROM public.plans WHERE code='free';

  INSERT INTO public.organizations (name, slug, business_type, city, state, country, phone, email,
      tax_number, address, is_demo, onboarding_step, onboarding_completed_at)
  VALUES ('Zenith Interiors Pvt Ltd','zenith-interiors','Interior Design & Fit-out','Mumbai','Maharashtra','India',
      '+91 22 4890 1200','hello@zenithinteriors.in','27AABCZ1234K1Z5','701 Peninsula Towers, Lower Parel, Mumbai 400013',
      true, 8, now())
  RETURNING id INTO org;

  INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_ends_at, renews_at)
  VALUES (org, plan_pro, 'active', now() + interval '14 days', now() + interval '27 days');

  INSERT INTO public.teams (organization_id, name, description) VALUES (org,'North Region','Delhi NCR, Punjab, UP') RETURNING id INTO t_north;
  INSERT INTO public.teams (organization_id, name, description) VALUES (org,'West Region','Maharashtra, Gujarat, Goa') RETURNING id INTO t_west;

  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Anita Deshpande','anita@zenithinteriors.in','owner','active',t_west, now()-interval '400 days') RETURNING id INTO m_owner;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Vikram Menon','vikram@zenithinteriors.in','sales_manager','active',t_west, now()-interval '320 days') RETURNING id INTO m_mgr;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Rahul Shetty','rahul@zenithinteriors.in','sales_executive','active',t_west, now()-interval '210 days') RETURNING id INTO m_rahul;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Priya Nair','priya@zenithinteriors.in','sales_executive','active',t_north, now()-interval '150 days') RETURNING id INTO m_priya;
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, team_id, joined_at)
    VALUES (org,'Sanjay Iyer','sanjay@zenithinteriors.in','accountant','active',NULL, now()-interval '260 days') RETURNING id INTO m_acct;

  SELECT id INTO s_new  FROM public.lead_statuses WHERE organization_id=org AND name='New';
  SELECT id INTO s_cont FROM public.lead_statuses WHERE organization_id=org AND name='Contacted';
  SELECT id INTO s_qual FROM public.lead_statuses WHERE organization_id=org AND name='Qualified';
  SELECT id INTO s_prop FROM public.lead_statuses WHERE organization_id=org AND name='Proposal Sent';
  SELECT id INTO s_neg  FROM public.lead_statuses WHERE organization_id=org AND name='Negotiation';
  SELECT id INTO s_won  FROM public.lead_statuses WHERE organization_id=org AND name='Won';
  SELECT id INTO s_lost FROM public.lead_statuses WHERE organization_id=org AND name='Lost';

  SELECT id INTO src_web  FROM public.lead_sources WHERE organization_id=org AND name='Website';
  SELECT id INTO src_ref  FROM public.lead_sources WHERE organization_id=org AND name='Referral';
  SELECT id INTO src_ads  FROM public.lead_sources WHERE organization_id=org AND name='Google Ads';
  SELECT id INTO src_cold FROM public.lead_sources WHERE organization_id=org AND name='Cold Call';
  SELECT id INTO src_exh  FROM public.lead_sources WHERE organization_id=org AND name='Exhibition';
  SELECT id INTO src_wa   FROM public.lead_sources WHERE organization_id=org AND name='WhatsApp';

  SELECT id INTO st_qual FROM public.deal_stages WHERE organization_id=org AND name='Qualification';
  SELECT id INTO st_disc FROM public.deal_stages WHERE organization_id=org AND name='Discovery';
  SELECT id INTO st_prop FROM public.deal_stages WHERE organization_id=org AND name='Proposal';
  SELECT id INTO st_neg  FROM public.deal_stages WHERE organization_id=org AND name='Negotiation';
  SELECT id INTO st_won  FROM public.deal_stages WHERE organization_id=org AND name='Won';
  SELECT id INTO st_lost FROM public.deal_stages WHERE organization_id=org AND name='Lost';

  INSERT INTO public.tags (organization_id, name, color) VALUES
    (org,'Enterprise','violet'),(org,'Retail','amber'),(org,'Repeat Client','emerald'),
    (org,'Price Sensitive','rose'),(org,'Hot','orange');

  -- CLIENTS
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, website,
      tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0001','Sunrise Hospitality Group','Meera Kulkarni','+91 98200 41122','meera@sunrisehg.in','sunrisehg.in','27AACCS8821L1Z2','Plot 14, Bandra Kurla Complex, Mumbai 400051','Hospitality',m_mgr,'vip',m_owner, now()-interval '380 days') RETURNING id INTO c1;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0002','Kamath Retail Ventures','Girish Kamath','+91 98450 77310','girish@kamathretail.com','29AAECK5512M1Z8','MG Road, Bengaluru 560001','Retail',m_rahul,'active',m_owner, now()-interval '300 days') RETURNING id INTO c2;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0003','Arihant Realty LLP','Nikhil Jain','+91 99300 22114','nikhil@arihantrealty.in','27AAFFA1290P1ZQ','Andheri East, Mumbai 400069','Real Estate',m_mgr,'active',m_owner, now()-interval '260 days') RETURNING id INTO c3;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0004','Medicare Diagnostics','Dr. Shalini Rao','+91 96540 88123','shalini@medicarediag.in','07AADCM7712H1Z4','Nehru Place, New Delhi 110019','Healthcare',m_priya,'active',m_owner, now()-interval '190 days') RETURNING id INTO c4;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0005','Tanvi Fashions','Tanvi Mehta','+91 97690 10045','tanvi@tanvifashions.com','24AAGCT3311R1ZX','CG Road, Ahmedabad 380009','Apparel',m_rahul,'at_risk',m_owner, now()-interval '150 days') RETURNING id INTO c5;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0006','Orbit Technologies','Arjun Pillai','+91 90040 55219','arjun@orbittech.io','36AAFCO9910N1Z7','Hitec City, Hyderabad 500081','IT Services',m_priya,'active',m_owner, now()-interval '120 days') RETURNING id INTO c6;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0007','Greenleaf Cafes','Rohit Sinha','+91 98111 34567','rohit@greenleafcafes.in','07AAKCG4412J1Z1','Hauz Khas, New Delhi 110016','F&B',m_priya,'active',m_owner, now()-interval '95 days') RETURNING id INTO c7;
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, tax_number, billing_address, industry, account_manager_id, status, created_by, created_at) VALUES
    (org,'CL-0008','Vardhman Textiles Ltd','Suresh Agarwal','+91 98760 21188','suresh@vardhmantex.in','03AABCV6621D1Z9','Ludhiana 141003, Punjab','Manufacturing',m_mgr,'inactive',m_owner, now()-interval '60 days') RETURNING id INTO c8;

  INSERT INTO public.client_contacts (organization_id, client_id, name, job_title, phone, email, is_primary) VALUES
    (org,c1,'Meera Kulkarni','Director – Projects','+91 98200 41122','meera@sunrisehg.in',true),
    (org,c1,'Feroz Khan','Purchase Head','+91 98200 41199','feroz@sunrisehg.in',false),
    (org,c3,'Nikhil Jain','Managing Partner','+91 99300 22114','nikhil@arihantrealty.in',true),
    (org,c6,'Arjun Pillai','Head of Facilities','+91 90040 55219','arjun@orbittech.io',true);

  -- LEADS
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at) VALUES
   (org,'LD-0001','Kavita','Raghavan','Lumina Coworking','Founder','+91 98330 11002','kavita@luminacowork.in','Pune','Maharashtra',src_web,s_new,'Coworking','high',2200000,m_rahul,m_mgr,NULL,now()+interval '4 hours','Enquiry for 12,000 sq ft coworking fit-out.',now()-interval '2 days'),
   (org,'LD-0003','Deepa','Krishnan','Nova Learning Labs','Director','+91 96320 55110','deepa@novalabs.edu.in','Chennai','Tamil Nadu',src_ads,s_cont,'Education','medium',1450000,m_priya,m_mgr,now()-interval '5 days',now()-interval '1 day','Wants a phased rollout across 3 campuses.',now()-interval '25 days'),
   (org,'LD-0004','Harish','Bhatt','Bhatt & Sons Jewellers','Owner','+91 98250 90011','harish@bhattjewellers.in','Surat','Gujarat',src_exh,s_prop,'Retail','high',3800000,m_rahul,m_mgr,now()-interval '2 days',now()+interval '3 days','Proposal sent for flagship showroom.',now()-interval '32 days'),
   (org,'LD-0006','Rakesh','Yadav','Yadav Logistics Park','Director','+91 98110 66234','rakesh@yadavlogistics.in','Gurugram','Haryana',src_cold,s_new,'Logistics','low',900000,m_priya,m_priya,NULL,now()+interval '6 days','Office block only. Small budget.',now()-interval '4 days'),
   (org,'LD-0007','Farah','Ansari','Ansari Textiles','Partner','+91 98920 47712','farah@ansaritextiles.in','Bhiwandi','Maharashtra',src_wa,s_cont,'Manufacturing','medium',1750000,m_rahul,m_rahul,now()-interval '6 days',now(),'Asked for reference projects.',now()-interval '14 days'),
   (org,'LD-0008','Manish','Gupta','Silverline Motors','GM','+91 99991 20034','manish@silverlinemotors.in','Jaipur','Rajasthan',src_ref,s_qual,'Automotive','medium',4100000,m_priya,m_mgr,now()-interval '8 days',now()+interval '5 days','Showroom + service centre.',now()-interval '29 days'),
   (org,'LD-0010','Sameer','Joshi','Joshi Pharma Distributors','Owner','+91 98220 77451','sameer@joshipharma.in','Nashik','Maharashtra',src_cold,s_lost,'Pharma','low',650000,m_rahul,m_rahul,now()-interval '30 days',NULL,'Went with a local contractor on price.',now()-interval '68 days'),
   (org,'LD-0011','Ritu','Malhotra','Malhotra Fine Dine','Proprietor','+91 98180 22119','ritu@malhotrafinedine.in','New Delhi','Delhi',src_ads,s_prop,'F&B','urgent',2400000,m_priya,m_priya,now()-interval '2 days',now()-interval '2 days','Waiting on revised quotation.',now()-interval '22 days'),
   (org,'LD-0012','Aditya','Rane','Rane Sports Academy','Founder','+91 90110 88342','aditya@raneacademy.in','Pune','Maharashtra',src_ref,s_new,'Sports','medium',1100000,m_rahul,m_rahul,NULL,now()+interval '2 days','Indoor courts and lounge area.',now()-interval '1 day'),
   (org,'LD-0013','Neha','Bansal','Bansal Educare','Trustee','+91 98991 33028','neha@bansaleducare.in','Chandigarh','Punjab',src_exh,s_cont,'Education','medium',1900000,m_priya,m_mgr,now()-interval '9 days',now()+interval '1 day','Site visit scheduled.',now()-interval '20 days'),
   (org,'LD-0014','Prakash','Nambiar','Coastal Foods Pvt Ltd','VP Ops','+91 94470 51120','prakash@coastalfoods.in','Kochi','Kerala',src_web,s_qual,'FMCG','high',3300000,m_mgr,m_mgr,now()-interval '4 days',now()+interval '4 days','Corporate office relocation.',now()-interval '27 days'),
   (org,'LD-0015','Divya','Sharma','Sharma Diagnostics','Director','+91 98290 66701','divya@sharmadiag.in','Jodhpur','Rajasthan',src_wa,s_new,'Healthcare','low',780000,m_priya,m_priya,NULL,now()+interval '8 days','Single-floor clinic.',now()-interval '3 days'),
   (org,'LD-0016','Vinod','Chandra','Chandra Auto Works','Owner','+91 98400 12234','vinod@chandraauto.in','Coimbatore','Tamil Nadu',src_cold,s_lost,'Automotive','low',560000,m_rahul,m_rahul,now()-interval '40 days',NULL,'Budget deferred to next year.',now()-interval '80 days'),
   (org,'LD-0017','Meghna','Roy','Roy & Co Chartered','Partner','+91 98300 44018','meghna@royco.in','Kolkata','West Bengal',src_ref,s_prop,'Professional Services','medium',1350000,m_priya,m_mgr,now()-interval '3 days',now()+interval '6 days','Office of 4,500 sq ft.',now()-interval '19 days'),
   (org,'LD-0019','Lakshmi','Iyer','Iyer Wellness Spa','Founder','+91 98860 33447','lakshmi@iyerspa.in','Mysuru','Karnataka',src_web,s_cont,'Wellness','medium',1050000,m_rahul,m_rahul,now()-interval '7 days',now()-interval '3 days','Needs concept drawings.',now()-interval '16 days'),
   (org,'LD-0020','Abhishek','Dubey','Dubey Constructions','MD','+91 98930 20081','abhishek@dubeyconstruct.in','Indore','Madhya Pradesh',src_exh,s_qual,'Construction','high',4600000,m_mgr,m_mgr,now()-interval '5 days',now()+interval '3 days','Sample flat interiors, 6 towers.',now()-interval '35 days'),
   (org,'LD-0021','Pooja','Reddy','Reddy Fine Jewels','Owner','+91 90000 41123','pooja@reddyfinejewels.in','Hyderabad','Telangana',src_ref,s_new,'Retail','high',2750000,m_priya,m_priya,NULL,now()+interval '5 hours','Referred by Orbit Technologies.',now()-interval '1 day'),
   (org,'LD-0022','Gaurav','Khanna','Khanna Motors Group','CEO','+91 98110 90012','gaurav@khannamotors.in','Noida','Uttar Pradesh',src_ads,s_cont,'Automotive','medium',3100000,m_priya,m_mgr,now()-interval '11 days',now()-interval '4 days','No response to last two calls.',now()-interval '30 days'),
   (org,'LD-0023','Shweta','Pandey','Pandey Boutique Stays','Founder','+91 97110 55004','shweta@pandeystays.in','Rishikesh','Uttarakhand',src_web,s_qual,'Hospitality','medium',1850000,m_mgr,m_mgr,now()-interval '6 days',now()+interval '2 days','12-room boutique property.',now()-interval '23 days'),
   (org,'LD-0024','Nitin','Kulkarni','Kulkarni Foods','Director','+91 98220 11009','nitin@kulkarnifoods.in','Pune','Maharashtra',src_wa,s_new,'FMCG','medium',1600000,m_rahul,m_rahul,NULL,now()+interval '1 day','Cafeteria and pantry redesign.',now()-interval '6 hours');

  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0002','Imran','Shaikh','Blue Orchid Hotels','GM Operations','+91 99870 33421','imran@blueorchid.in','Goa','Goa',src_ref,s_qual,'Hospitality','urgent',6500000,m_mgr,m_mgr,now()-interval '3 days',now()+interval '1 day','Renovation of 48 keys. Budget approved.',now()-interval '18 days')
   RETURNING id INTO l2;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0005','Sneha','Kulkarni','Aster Wellness Clinics','COO','+91 90280 41765','sneha@asterwellness.in','Nagpur','Maharashtra',src_web,s_neg,'Healthcare','high',2950000,m_mgr,m_owner,now()-interval '1 day',now()+interval '2 days','Negotiating on the civil works scope.',now()-interval '41 days')
   RETURNING id INTO l5;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at)
   VALUES (org,'LD-0018','Karan','Sethi','Sethi Hypermart','Director','+91 99880 71120','karan@sethihypermart.in','Ludhiana','Punjab',src_ads,s_neg,'Retail','urgent',7200000,m_mgr,m_owner,now()-interval '1 day',now()+interval '1 day','Final commercial round.',now()-interval '48 days')
   RETURNING id INTO l18;
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, job_title, phone, email,
      city, state, source_id, status_id, industry, priority, estimated_value, assigned_member_id, created_by,
      last_contacted_at, next_followup_at, notes, created_at, converted_at, converted_client_id)
   VALUES (org,'LD-0009','Anjali','Verma','Verma Hospitality','Director','+91 98730 55123','anjali@vermahosp.in','Lucknow','Uttar Pradesh',src_web,s_won,'Hospitality','high',5200000,m_mgr,m_owner,now()-interval '20 days',NULL,'Converted — boutique hotel project.',now()-interval '75 days', now()-interval '18 days', c1)
   RETURNING id INTO l9;

  -- DEALS
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0001','Sunrise – Juhu Property Refresh',c1,m_mgr,st_won,8400000,100,CURRENT_DATE-40,now()-interval '40 days','Referral','won','high',m_owner,now()-interval '160 days') RETURNING id INTO d1;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0002','Kamath Retail – Bengaluru Flagship',c2,m_rahul,st_won,5600000,100,CURRENT_DATE-25,now()-interval '25 days','Website','won','high',m_owner,now()-interval '120 days') RETURNING id INTO d2;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0003','Arihant – Sample Flat Interiors',c3,m_mgr,st_neg,4200000,75,CURRENT_DATE+18,'Referral','open','urgent',m_owner,now()-interval '55 days') RETURNING id INTO d3;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0004','Medicare – Delhi Lab Expansion',c4,m_priya,st_prop,2650000,50,CURRENT_DATE+22,'Google Ads','open','high',m_owner,now()-interval '38 days') RETURNING id INTO d4;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0005','Tanvi Fashions – Store Rollout Ph2',c5,m_rahul,st_disc,1850000,25,CURRENT_DATE+35,'Existing Customer','open','medium',m_owner,now()-interval '30 days') RETURNING id INTO d5;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0006','Orbit – Hyderabad Office Fit-out',c6,m_priya,st_prop,6100000,50,CURRENT_DATE+12,'Referral','open','urgent',m_owner,now()-interval '44 days') RETURNING id INTO d6;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0007','Greenleaf – 4 Outlet Refresh',c7,m_priya,st_qual,1400000,10,CURRENT_DATE+48,'Website','open','low',m_owner,now()-interval '18 days') RETURNING id INTO d7;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, assigned_member_id, stage_id, value, probability, expected_close_date, closed_at, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0008','Vardhman – Admin Block',c8,m_mgr,st_lost,3200000,0,CURRENT_DATE-15,now()-interval '15 days','Cold Call','lost','medium',m_owner,now()-interval '90 days') RETURNING id INTO d8;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, lead_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0009','Blue Orchid – 48 Key Renovation',NULL,l2,m_mgr,st_disc,6500000,25,CURRENT_DATE+40,'Referral','open','urgent',m_mgr,now()-interval '15 days') RETURNING id INTO d9;
  INSERT INTO public.deals (organization_id, deal_number, name, client_id, lead_id, assigned_member_id, stage_id, value, probability, expected_close_date, source, status, priority, created_by, created_at)
   VALUES (org,'DL-0010','Sethi Hypermart – Ludhiana Store',NULL,l18,m_mgr,st_neg,7200000,75,CURRENT_DATE+9,'Google Ads','open','urgent',m_owner,now()-interval '20 days') RETURNING id INTO d10;

  UPDATE public.leads SET converted_deal_id = d1 WHERE id = l9;

  -- QUOTATIONS
  INSERT INTO public.quotations (organization_id, quotation_number, client_id, deal_id, issue_date, expiry_date,
      subtotal, discount_total, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'QTN-0007',c3,d3,CURRENT_DATE-12,CURRENT_DATE+18,4200000,100000,738000,4838000,'sent','50% advance, 40% on delivery, 10% on handover.',m_mgr,now()-interval '12 days') RETURNING id INTO q1;
  INSERT INTO public.quotations (organization_id, quotation_number, client_id, deal_id, issue_date, expiry_date,
      subtotal, discount_total, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'QTN-0008',c6,d6,CURRENT_DATE-6,CURRENT_DATE+24,6100000,0,1098000,7198000,'viewed','40% advance, balance milestone-linked.',m_priya,now()-interval '6 days') RETURNING id INTO q2;
  INSERT INTO public.quotation_items (organization_id, quotation_id, description, quantity, unit_price, discount_percent, tax_percent, line_total, sort_order) VALUES
   (org,q1,'Modular furniture and workstations',1,2400000,0,18,2832000,1),
   (org,q1,'Civil, ceiling and flooring works',1,1800000,5,18,2018520,2),
   (org,q2,'Interior design and 3D visualisation',1,600000,0,18,708000,1),
   (org,q2,'Turnkey fit-out execution – 18,000 sq ft',1,5500000,0,18,6490000,2);

  -- INVOICES
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, deal_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0021',c1,d1,CURRENT_DATE-38,CURRENT_DATE-23,8400000,1512000,9912000,'sent','Net 15',m_acct,now()-interval '38 days') RETURNING id INTO i1;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, deal_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0022',c2,d2,CURRENT_DATE-24,CURRENT_DATE-9,5600000,1008000,6608000,'sent','Net 15',m_acct,now()-interval '24 days') RETURNING id INTO i2;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0023',c4,CURRENT_DATE-18,CURRENT_DATE-3,1250000,225000,1475000,'sent','Net 15',m_acct,now()-interval '18 days') RETURNING id INTO i3;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0024',c5,CURRENT_DATE-45,CURRENT_DATE-30,980000,176400,1156400,'sent','Net 15',m_acct,now()-interval '45 days') RETURNING id INTO i4;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0025',c6,CURRENT_DATE-4,CURRENT_DATE+11,2100000,378000,2478000,'sent','Net 15',m_acct,now()-interval '4 days') RETURNING id INTO i5;
  INSERT INTO public.invoices (organization_id, invoice_number, client_id, issue_date, due_date,
      subtotal, tax_total, total, status, terms, created_by, created_at)
   VALUES (org,'INV-0026',c7,CURRENT_DATE-1,CURRENT_DATE+14,640000,115200,755200,'draft','Net 15',m_acct,now()-interval '1 day') RETURNING id INTO i6;

  INSERT INTO public.invoice_items (organization_id, invoice_id, description, quantity, unit_price, tax_percent, line_total, sort_order) VALUES
   (org,i1,'Turnkey interior fit-out – Juhu property',1,8400000,18,9912000,1),
   (org,i2,'Flagship store fit-out – Bengaluru',1,5600000,18,6608000,1),
   (org,i3,'Lab expansion – civil and MEP works',1,1250000,18,1475000,1),
   (org,i4,'Store refresh – Ahmedabad',1,980000,18,1156400,1),
   (org,i5,'Design retainer and site mobilisation',1,2100000,18,2478000,1),
   (org,i6,'Outlet refresh – concept and drawings',1,640000,18,755200,1);

  -- PAYMENTS (triggers recalculate invoice paid/outstanding/status)
  INSERT INTO public.payments (organization_id, payment_number, invoice_id, client_id, deal_id, amount, paid_on, method, reference, recorded_by, created_at) VALUES
   (org,'PAY-0031',i1,c1,d1,5000000,CURRENT_DATE-30,'bank_transfer','NEFT/HDFC/884213',m_acct,now()-interval '30 days'),
   (org,'PAY-0032',i1,c1,d1,4912000,CURRENT_DATE-20,'bank_transfer','NEFT/HDFC/889902',m_acct,now()-interval '20 days'),
   (org,'PAY-0033',i2,c2,d2,3000000,CURRENT_DATE-14,'bank_transfer','RTGS/ICIC/551200',m_acct,now()-interval '14 days'),
   (org,'PAY-0034',i3,c4,NULL,475000,CURRENT_DATE-8,'upi','UPI/9821/44120',m_acct,now()-interval '8 days'),
   (org,'PAY-0035',i5,c6,NULL,1000000,CURRENT_DATE-2,'cheque','CHQ 442190',m_acct,now()-interval '2 days');

  -- FOLLOW-UPS
  INSERT INTO public.follow_ups (organization_id, lead_id, client_id, deal_id, invoice_id, assigned_member_id, type, due_at, priority, status, subject, notes, created_by, created_at) VALUES
   (org,l2,NULL,d9,NULL,m_mgr,'call',date_trunc('day',now())+interval '11 hours','urgent','pending','Confirm site survey date','Client asked to call before 12 pm.',m_mgr,now()-interval '3 days'),
   (org,NULL,c3,d3,NULL,m_mgr,'meeting',date_trunc('day',now())+interval '15 hours 30 minutes','high','pending','Commercial discussion at Andheri office',NULL,m_owner,now()-interval '5 days'),
   (org,NULL,c4,NULL,i3,m_acct,'payment_reminder',date_trunc('day',now())+interval '17 hours','high','pending','Follow up balance ₹10,00,000','Invoice INV-0023 is past due.',m_acct,now()-interval '2 days'),
   (org,NULL,c5,NULL,i4,m_acct,'payment_reminder',now()-interval '2 days','urgent','pending','Overdue payment – Tanvi Fashions','No response to two reminders.',m_acct,now()-interval '10 days'),
   (org,NULL,NULL,d10,NULL,m_mgr,'call',now()-interval '1 day','urgent','pending','Chase final commercial approval',NULL,m_owner,now()-interval '6 days'),
   (org,NULL,c6,d6,NULL,m_priya,'demo',now()+interval '2 days','high','pending','Material and finish samples walkthrough',NULL,m_priya,now()-interval '4 days'),
   (org,NULL,c2,NULL,i2,m_acct,'payment_reminder',now()+interval '3 days','medium','pending','Collect balance ₹36,08,000',NULL,m_acct,now()-interval '5 days'),
   (org,NULL,c1,d1,NULL,m_mgr,'meeting',now()-interval '12 days','high','completed','Project handover review','Walkthrough completed with Meera.',m_mgr,now()-interval '20 days'),
   (org,NULL,c2,d2,NULL,m_rahul,'call',now()-interval '6 days','medium','completed','Post-handover check-in',NULL,m_rahul,now()-interval '12 days');

  UPDATE public.follow_ups SET completed_at = due_at + interval '1 hour',
    outcome = CASE WHEN subject = 'Project handover review'
      THEN 'Client happy with delivery. Asked for a quote on the Powai property.'
      ELSE 'Store operating well. Will revisit Phase 2 next quarter.' END
   WHERE organization_id=org AND status='completed';

  -- ACTIVITIES
  INSERT INTO public.activities (organization_id, type, title, description, lead_id, client_id, deal_id, actor_member_id, actor_name, occurred_at) VALUES
   (org,'lead_created','Lead created','Blue Orchid Hotels added from a referral.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '18 days'),
   (org,'call','Call completed','Discussed scope for 48 keys. Budget confirmed at ₹65 L.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '3 days'),
   (org,'deal_created','Deal created','Blue Orchid – 48 Key Renovation created at ₹65,00,000.',l2,NULL,d9,m_mgr,'Vikram Menon',now()-interval '15 days'),
   (org,'status_changed','Status changed','Lead moved from Contacted to Qualified.',l2,NULL,NULL,m_mgr,'Vikram Menon',now()-interval '10 days'),
   (org,'quotation_sent','Quotation sent','QTN-0007 sent to Arihant Realty LLP for ₹48,38,000.',NULL,c3,d3,m_mgr,'Vikram Menon',now()-interval '12 days'),
   (org,'deal_updated','Stage changed','Arihant deal moved from Proposal to Negotiation.',NULL,c3,d3,m_mgr,'Vikram Menon',now()-interval '5 days'),
   (org,'deal_won','Deal won','Sunrise – Juhu Property Refresh won at ₹84,00,000.',NULL,c1,d1,m_mgr,'Vikram Menon',now()-interval '40 days'),
   (org,'invoice_created','Invoice created','INV-0021 raised for ₹99,12,000.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '38 days'),
   (org,'payment_received','Payment received','₹50,00,000 received against INV-0021.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '30 days'),
   (org,'payment_received','Payment received','₹49,12,000 received against INV-0021. Invoice fully paid.',NULL,c1,d1,m_acct,'Sanjay Iyer',now()-interval '20 days'),
   (org,'followup_completed','Follow-up completed','Project handover review completed.',NULL,c1,d1,m_mgr,'Vikram Menon',now()-interval '12 days'),
   (org,'payment_reminder','Payment reminder sent','Reminder sent to Tanvi Fashions for INV-0024.',NULL,c5,NULL,m_acct,'Sanjay Iyer',now()-interval '4 days'),
   (org,'note','Note added','Client wants LEED-compliant materials throughout.',NULL,c6,d6,m_priya,'Priya Nair',now()-interval '2 days'),
   (org,'deal_lost','Deal lost','Vardhman – Admin Block lost on commercials.',NULL,c8,d8,m_mgr,'Vikram Menon',now()-interval '15 days');

  -- NOTIFICATIONS
  INSERT INTO public.notifications (organization_id, member_id, type, title, body, link, created_at) VALUES
   (org,m_mgr,'followup_due','Follow-up due today','Call Imran Shaikh – Blue Orchid Hotels at 11:00 AM.','/followups',now()-interval '2 hours'),
   (org,m_mgr,'followup_overdue','Follow-up overdue','Chase final commercial approval – Sethi Hypermart.','/followups',now()-interval '1 day'),
   (org,m_acct,'invoice_overdue','Invoice overdue','INV-0024 for Tanvi Fashions is 30 days overdue.','/invoices',now()-interval '3 days'),
   (org,m_acct,'payment_received','Payment received','₹10,00,000 received from Orbit Technologies.','/payments',now()-interval '2 days'),
   (org,m_priya,'lead_assigned','New lead assigned','Reddy Fine Jewels was assigned to you.','/leads',now()-interval '1 day');

  -- AUTOMATIONS
  INSERT INTO public.automation_rules (organization_id, name, description, trigger_event, conditions, actions) VALUES
   (org,'Follow up after proposal','Create a call follow-up 3 days after a lead reaches Proposal Sent.','lead.status_changed',
    '{"to_status":"Proposal Sent"}','[{"type":"create_followup","offset_days":3,"followup_type":"call","priority":"high"}]'),
   (org,'Chase overdue invoices','Create a payment follow-up when an invoice goes 3 days overdue.','invoice.overdue',
    '{"days_overdue":3}','[{"type":"create_followup","followup_type":"payment_reminder","priority":"urgent"}]'),
   (org,'Onboard won deals','When a deal is won, create the client if needed and add an onboarding task.','deal.won',
    '{}','[{"type":"ensure_client"},{"type":"create_followup","offset_days":2,"followup_type":"meeting","subject":"Kick-off and onboarding"}]');

  -- ===== SECOND ORG (isolation check) =====
  INSERT INTO public.organizations (name, slug, business_type, city, country, currency, currency_symbol, is_demo)
  VALUES ('Northwind Traders','northwind-traders','Wholesale Distribution','Pune','India','INR','₹', false)
  RETURNING id INTO org2;
  INSERT INTO public.subscriptions (organization_id, plan_id, status) VALUES (org2, plan_free, 'active');
  INSERT INTO public.organization_members (organization_id, full_name, email, role, status, joined_at)
   VALUES (org2,'Ramesh Gokhale','ramesh@northwindtraders.in','owner','active',now()-interval '30 days') RETURNING id INTO o2m;
  SELECT id INTO o2s FROM public.lead_sources WHERE organization_id=org2 AND name='Website';
  SELECT id INTO o2st FROM public.lead_statuses WHERE organization_id=org2 AND name='New';
  INSERT INTO public.clients (organization_id, client_code, company_name, contact_person, phone, email, account_manager_id, created_by)
   VALUES (org2,'CL-0001','Konkan Distributors','Sagar Patil','+91 90210 33440','sagar@konkandist.in',o2m,o2m);
  INSERT INTO public.leads (organization_id, lead_number, first_name, last_name, company, phone, email, city,
      source_id, status_id, priority, estimated_value, assigned_member_id, created_by)
   VALUES (org2,'LD-0001','Sagar','Patil','Konkan Distributors','+91 90210 33440','sagar@konkandist.in','Pune',o2s,o2st,'medium',450000,o2m,o2m),
          (org2,'LD-0002','Alka','Deo','Deo Traders','+91 90210 88112','alka@deotraders.in','Nashik',o2s,o2st,'low',260000,o2m,o2m);
END $$;