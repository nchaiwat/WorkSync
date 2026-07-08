--
-- PostgreSQL database dump
--

\restrict ltyMee4q9IfTeV4Y2SYh8LnRCJXIEdewmpRKlG7xE7yEfx0wmh2yVzLN2MIJnTs

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: worksync
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE public."Role" OWNER TO worksync;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO worksync;

--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.login_logs (
    id text NOT NULL,
    username text NOT NULL,
    auth_type text NOT NULL,
    ip_address text NOT NULL,
    status text NOT NULL,
    message text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.login_logs OWNER TO worksync;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.task_comments (
    id text NOT NULL,
    task text NOT NULL,
    "user" text NOT NULL,
    message text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_key text
);


ALTER TABLE public.task_comments OWNER TO worksync;

--
-- Name: task_likes; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.task_likes (
    id text NOT NULL,
    task_id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    target_id text DEFAULT ''::text NOT NULL,
    target_type text DEFAULT 'task'::text NOT NULL
);


ALTER TABLE public.task_likes OWNER TO worksync;

--
-- Name: task_reads; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.task_reads (
    id text NOT NULL,
    task_id text NOT NULL,
    user_id text NOT NULL,
    read_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_reads OWNER TO worksync;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    deadline timestamp(3) without time zone,
    avatar_url text,
    collaborators jsonb,
    created_by text,
    latest_update text,
    project_owner text,
    previous_progress integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    assignee text NOT NULL,
    manager text,
    archive_reason text,
    is_archived boolean DEFAULT false NOT NULL
);


ALTER TABLE public.tasks OWNER TO worksync;

--
-- Name: users; Type: TABLE; Schema: public; Owner: worksync
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text,
    username text NOT NULL,
    password text NOT NULL,
    nickname text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    department text,
    "position" text,
    avatar_url text,
    telegram_id text,
    pin_code text,
    is_ad_auth boolean DEFAULT false NOT NULL,
    devices jsonb DEFAULT '[]'::jsonb,
    last_access timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO worksync;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
3ad70842-db62-449b-99b0-2ca42eee43a0	5095d909e0753ab7a37047fa0ffd672ae3a527c090ccbd5cfa8e387c1778be61	\N	20260613174653_add_is_ad_auth	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260613174653_add_is_ad_auth\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "users" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"users\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(434), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260613174653_add_is_ad_auth"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260613174653_add_is_ad_auth"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2026-06-23 16:03:07.166526+00	2026-06-22 12:08:30.687297+00	0
d92748c4-c608-44e1-9753-c6598e46c80e	5095d909e0753ab7a37047fa0ffd672ae3a527c090ccbd5cfa8e387c1778be61	2026-06-23 16:03:07.170853+00	20260613174653_add_is_ad_auth		\N	2026-06-23 16:03:07.170853+00	0
3f615d8b-7ce0-4101-91b3-0cfc4e37c85e	8dbfe083bcc9479453f23ad28755e2e9aa6fbf94ba385292618c3fd301af112f	2026-06-23 16:03:42.459083+00	20260620000000_add_project_owner_and_previous_progress	\N	\N	2026-06-23 16:03:42.450798+00	1
\.


--
-- Data for Name: login_logs; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.login_logs (id, username, auth_type, ip_address, status, message, created_at) FROM stdin;
113cfb7f-055d-4a07-a568-29a008eae711	Chaiwat.N	AD	49.231.185.245	ERROR	Expired	2026-06-24 04:09:55.076
003ef53e-c2fa-4f57-aecf-b2d1eeb1ef20	Chaiwat	AD	49.231.185.245	DENIED	ไม่พบผู้ใช้งานนี้ในระบบ WorkSync	2026-06-24 04:10:31.396
17b8a41b-d9d2-4eef-bfaa-9d5bcfbe57b9	Chaiwat	AD	49.231.185.245	DENIED	ไม่พบผู้ใช้งานนี้ในระบบ WorkSync	2026-06-24 04:10:37.747
1f76bee5-902a-4fdd-b674-914974f5b610	Chaiwat	AD	49.231.185.245	DENIED	ไม่พบผู้ใช้งานนี้ในระบบ WorkSync	2026-06-24 04:10:52.596
ef249600-3408-4c57-8641-8d224866a32e	Chaiwat	AD	49.231.185.245	DENIED	ไม่พบผู้ใช้งานนี้ในระบบ WorkSync	2026-06-24 04:24:04.602
c42c16d1-a0c5-405e-a551-fa17bb4195d6	Chaiwat	AD	49.231.185.245	DENIED	ไม่พบผู้ใช้งานนี้ในระบบ WorkSync	2026-06-24 04:31:31.825
75e295e2-4089-4df8-878f-fed9f22cf887	Chaiwat.N	AD	49.231.185.245	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ	2026-06-24 04:31:44.34
16172547-eab5-4cf9-adc5-661870ce0800	Thanaphat.C	LOCAL	183.88.245.230	REJECT	รหัสผ่านไม่ถูกต้อง	2026-06-24 07:49:54.194
65b1110d-a957-4f41-a9d7-643d736f8154	Thanaphat.C	AD	183.88.245.230	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ	2026-06-24 07:50:03.108
0a57af1d-7b0e-4408-8244-118081dc6800	Nakprat.P	LOCAL	183.88.245.230	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-06-25 02:54:06.338
a09ad007-f450-42ad-af8f-785c957623b5	admin	LOCAL	49.231.185.245	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-06-25 05:55:22.995
73d7bf2a-34cf-40fc-b3c8-ab33770d849f	admin	AD	49.231.185.245	DENIED	บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication	2026-06-25 07:04:23.214
7bbd51e0-dc02-4394-bc62-440332e26b6b	admin	AD	49.231.185.245	DENIED	บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication	2026-06-25 07:04:33.039
a23530b7-938a-430c-8b32-f623070c039c	admin	LOCAL	49.231.185.245	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-06-25 07:04:47.848
3d585a21-41cb-4584-bab7-c5da2cfc17ef	Chaiwat.N	LOCAL	49.231.185.245	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-06-25 09:27:51.682
b1d8d8f5-29c9-4291-89c8-34210ad7ada5	Chaiwat.N	AD	183.88.245.230	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ (ใช้ข้อมูลที่แคชไว้)	2026-07-01 06:48:15.254
4c60c936-cd99-48ff-80a0-697cfd7c5724	admin	LOCAL	183.88.245.230	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-07-01 07:05:35.441
08adf408-4ec7-4e03-9bf8-8a4e26b4013f	Chaiwat.N	AD	183.88.245.230	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ (ใช้ข้อมูลที่แคชไว้)	2026-07-01 09:22:00.941
ad218eb6-4a34-4323-987c-dbddeb3b6070	admin	AD	183.88.245.230	DENIED	บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication	2026-07-01 09:32:03.399
e8234c31-1f75-46b6-adfa-1a41fee32881	admin	AD	183.88.245.230	DENIED	บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication	2026-07-01 09:32:15.996
fab1d220-d353-4051-bb4e-1af3128ffe32	admin	AD	183.88.245.230	DENIED	บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication	2026-07-01 09:32:25.047
545562e0-b12c-4618-ad6f-8ef3193f2525	Chaiwat.N	AD	183.88.245.230	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ (ใช้ข้อมูลที่แคชไว้)	2026-07-01 09:32:32.075
9282e36a-d781-4cb8-9a9c-191e5689056a	admin	LOCAL	183.88.245.230	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-07-01 09:32:49.589
a269b1ae-16f6-4deb-9706-6a9ace3d79cb	Chaiwat.N	LOCAL	58.8.188.26	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-07-01 14:12:39.901
8be3562a-e29b-4c6a-9347-79a301f51774	Chaiwat.N	AD	49.231.185.245	ACCEPT	เข้าสู่ระบบผ่าน Active Directory สำเร็จ (ใช้ข้อมูลที่แคชไว้)	2026-07-02 09:18:49.293
8d8eba7e-a760-48d7-9e38-02257bca8325	admin	LOCAL	183.88.245.230	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-07-06 04:46:37.468
06d8b6aa-5c34-49d9-8b2f-9f6c21069847	Chaiwat.N	LOCAL	183.88.245.230	ACCEPT	เข้าสู่ระบบสำเร็จ	2026-07-06 04:48:22.366
\.


--
-- Data for Name: task_comments; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.task_comments (id, task, "user", message, created_at, update_key) FROM stdin;
00256254-a733-4ca2-b82c-9a1fe78c1e2d	e73b27cd-7236-45e7-9089-43ec8ee9e90c	Oat (Chaiwat)/IT	แก้ Code เรื่องการ update	2026-06-22 15:07:30.488	[22 มิ.ย. 2569 22:04]
dccd2f17-1b4a-491e-b8e7-f91aaeeb9295	e73b27cd-7236-45e7-9089-43ec8ee9e90c	Oat (Chaiwat)/IT	แก้ API ที่ทำให้การ Update ล่าช้า	2026-06-22 15:15:03.107	[22 มิ.ย. 2569 22:04]
494dd9a2-02f6-4d75-8fce-e921a29614f3	e73b27cd-7236-45e7-9089-43ec8ee9e90c	Oat (Chaiwat)/IT	ทดสอบการ Update comment	2026-06-22 15:42:40.882	[22 มิ.ย. 2569 22:04]
101f387c-e9da-479b-8440-d77c26ba0379	63fcc317-7c19-4b8e-8840-3e45b684c0eb	Pu (Phuwit)/IT	อาคารที่ทำPMหรือเป่าฝุ่นเสร็จแล้วมีดังนี้ได้แก่ ออฟฟิศใหม่	2026-06-24 04:04:21.75	\N
313b8f38-6c15-4931-80ed-70744ba58922	63fcc317-7c19-4b8e-8840-3e45b684c0eb	Pu (Phuwit)/IT	และ อาคารA โรงงาน1 โรงงาน2 โรงงาน3 แล้วก็โรงงาน4	2026-06-24 04:05:57.407	\N
c5b5585c-8a45-412f-a900-f8b77af782ba	63fcc317-7c19-4b8e-8840-3e45b684c0eb	Oat (Chaiwat)/IT	Good	2026-06-24 05:33:10.38	\N
d117d171-bf93-4439-97bb-af90652b4fb1	83506577-9acd-42b2-82be-c0f5c567e29e	Boy (Nakprat)/IT	รอพี่โอ๊ตประกาศ ให้ User WA ติดตั้ง Telegram และขอเลข Telegram มาบันทึก	2026-06-25 03:26:04.549	[25 มิ.ย. 2569 10:25]
0e9fa566-f323-4d00-a7f3-0dbc47bb06e1	83506577-9acd-42b2-82be-c0f5c567e29e	Oat (Chaiwat)/IT	ยังติดปัญหาสำหรับการยืนยันตัวตนแต่ละสาขาว่าจะทำอย่างไร รอได้ข้อสรุปแล้วจะประกาศ หรือาจจะแยก 2 เฟสเหมือน OTP ขอคิดดูก่อน แต่เรื่อง Join AD ดำเนินการต่อเลย	2026-06-25 03:29:38.268	[25 มิ.ย. 2569 10:25]
2b4e3633-a317-4f25-9b3a-ef2c5f8cd737	83506577-9acd-42b2-82be-c0f5c567e29e	Oat (Chaiwat)/IT	สรุป	2026-06-26 23:27:03.649	[25 มิ.ย. 2569 10:25]
7f80f124-2c57-413c-911e-fc8c56a51237	83506577-9acd-42b2-82be-c0f5c567e29e	Oat (Chaiwat)/IT	1. การเข้าใช้ Network Factory VPN OTP จากนั้น ใส่ User/Pass ของ AD ถ้า User ทั่วไป ยืนยันด้วย Telegram แต่ WAShop ไม่ต้องยืนยัน เข้าได้เลย	2026-06-26 23:29:40.384	[25 มิ.ย. 2569 10:25]
7eae8be3-6f4e-4cdb-a02b-19a8def37878	83506577-9acd-42b2-82be-c0f5c567e29e	Oat (Chaiwat)/IT	HO เหมือนกัน เข้าด้วย Network หรือVPN (HO ไม่มีคน VPN) จากนั้นใส่ User/Pass ของ AD แล้ว ยืนยันด้วย Telegram	2026-06-26 23:31:51.552	[25 มิ.ย. 2569 10:25]
2ccde9b1-96af-4662-bb7b-e14214b7c618	83506577-9acd-42b2-82be-c0f5c567e29e	Oat (Chaiwat)/IT	จะมีการติดตั้ง Linux เพิ่มที่ HO และ Fac อย่างละตัวสำหรับทำ MFA	2026-06-26 23:32:38.524	[25 มิ.ย. 2569 10:25]
bde33a74-f13b-4238-9096-4064a206cc30	b356046d-a97a-4602-bc3f-81f00849bdd7	Oat (Chaiwat)/IT	ส่วนเส้นเสร็จแล้ว Done ไปเลยนะ แล้วเริ่มกำหนด Tasks ใหม่	2026-07-06 14:15:24.3	[6 ก.ค. 2569 11:08]
\.


--
-- Data for Name: task_likes; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.task_likes (id, task_id, user_id, created_at, target_id, target_type) FROM stdin;
a26ac8c0-aae5-48f4-821e-69a830b4162d	921f3d75-b8e5-40d6-9f6f-e7c50d739b8d	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 09:52:59.833		task
997a7603-f73a-405c-ac1d-be6894ac5d0d	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 09:53:37.933		task
4a7650c9-a114-4a18-9f6d-b2b52b7f60d6	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:07:18.061	[1 ก.ค. 2569 13:58]	update
7ec3ea64-a3b6-4ef2-b53e-695f4fc72b57	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:14:05.343	[25 มิ.ย. 2569 09:50]	update
ed99984b-3111-4d14-8aba-e306239a24bc	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:14:27.139	[24 มิ.ย. 2569 11:00]	update
ebca7047-905b-43bf-84bf-23191c51c7ba	63fcc317-7c19-4b8e-8840-3e45b684c0eb	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:18:06.598	101f387c-e9da-479b-8440-d77c26ba0379	comment
6bb7d9f7-21f0-4bc1-9a37-f3709e4efa83	63fcc317-7c19-4b8e-8840-3e45b684c0eb	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:18:12.177	313b8f38-6c15-4931-80ed-70744ba58922	comment
c7006e64-bc7d-41e1-bb9e-27a5b5a69f10	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:20:14.972	[2 ก.ค. 2569 15:02]	update
cf971c70-f7ae-4cd6-aa48-ee8a36c6b832	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:20:23.445	[2 ก.ค. 2569 15:01]	update
3d5de2be-b775-4497-99fd-a010c604cf0d	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:29:16.337	[2 ก.ค. 2569 16:15]	update
9d97d777-1c5a-459b-a2ce-5fee6d61251d	63fcc317-7c19-4b8e-8840-3e45b684c0eb	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:35:31.897	c5b5585c-8a45-412f-a900-f8b77af782ba	comment
2a162915-1b80-4f0f-ba22-08e55fd9226b	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:35:58.981	[25 มิ.ย. 2569 10:25]	update
9a4d9a28-066a-4479-9ada-8a60e93c4ab5	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:46:45.26	d117d171-bf93-4439-97bb-af90652b4fb1	comment
65c0ad5c-5e7f-4db3-92ad-ff35c54b55a5	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:46:50.62	[25 มิ.ย. 2569 10:24]	update
3fdc5676-0911-4f10-ab6d-dded75d4d9db	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:46:54.774	[25 มิ.ย. 2569 10:23]	update
2779022d-dbad-436a-8bdb-ebeb1d813ae5	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:47:54.194	[25 มิ.ย. 2569 09:45]	update
51f2f197-5e4d-48bd-a2e8-d606fc72d922	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-04 09:02:27.018	[4 ก.ค. 2569 15:54]	update
b8c3184e-65c0-49ff-921f-1f817c8bee15	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-06 05:47:29.156	[6 ก.ค. 2569 11:08]	update
\.


--
-- Data for Name: task_reads; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.task_reads (id, task_id, user_id, read_at) FROM stdin;
b3bed379-0d32-4edb-82b2-41f5feb30b0d	5ed1ce0a-7adc-459b-851e-93ebe5f1f2f6	1989c8e9-66d8-4425-8d69-13d75a4fbbe4	2026-07-04 09:55:23.325
17adc9bc-956d-4f1d-b967-9711c3db66fc	b356046d-a97a-4602-bc3f-81f00849bdd7	1989c8e9-66d8-4425-8d69-13d75a4fbbe4	2026-07-06 04:08:40.965
3a1c50be-2e3b-424d-979d-3debf4205c07	63fcc317-7c19-4b8e-8840-3e45b684c0eb	1989c8e9-66d8-4425-8d69-13d75a4fbbe4	2026-07-06 04:09:04.336
bd681006-b646-4a85-9ae6-74a37992e593	5ed1ce0a-7adc-459b-851e-93ebe5f1f2f6	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-06 04:53:12.651
7cdb466b-ae76-44fd-b9e4-8a4aed7312da	83506577-9acd-42b2-82be-c0f5c567e29e	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-06 05:45:36.278
70eb2a9d-63ea-4c6d-ab43-cd36bf2d420e	63fcc317-7c19-4b8e-8840-3e45b684c0eb	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-06 05:59:29.767
855f3c9e-161f-4e14-8171-943205ebd005	b356046d-a97a-4602-bc3f-81f00849bdd7	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-06 14:14:38.987
9eb48205-1ac9-48b9-9ba2-86fc6831cf26	921f3d75-b8e5-40d6-9f6f-e7c50d739b8d	c3674215-02a0-437f-bf8c-01d88623cf9d	2026-07-02 14:28:11.549
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.tasks (id, title, description, status, priority, progress, deadline, avatar_url, collaborators, created_by, latest_update, project_owner, previous_progress, created_at, updated_at, assignee, manager, archive_reason, is_archived) FROM stdin;
e73b27cd-7236-45e7-9089-43ec8ee9e90c	WorkSync	Mobile App สำหรับการ Update Tasks/Projects ให้กับหัวหน้างาน และผู้ร่วมงานที่เกี่ยวข้อง อย่างง่ายๆ	done	medium	100	2026-07-06 05:00:00		["Boy (Nakprat)/IT", "Sense (Thanaphat)/IT"]	c3674215-02a0-437f-bf8c-01d88623cf9d	[1 ก.ค. 2569 21:15] เสร็จ Phase 1\n---\n[24 มิ.ย. 2569 12:36] หน้า Login มีให้เลือก Authen ด้วย AD จะทำให้สามารถใช้ User/Pass เดียวกับ AD ได้เลย ทั้งนี้ Aadmin จะต้องอนุญาติให้ User นั้นๆสามารถ Login ด้วย AD ได้ (ทุกคนสามารถใช้ AD Login ได้นะ)\n---\n[24 มิ.ย. 2569 08:53] ลืมแจ้ง ต้องค้นห้า Bot @waagm_bot แล้วทำการ Start ด้วยเพื่อจะได้รับ Notify\n---\n[24 มิ.ย. 2569 08:49] - เพิ่มแสดงการ Update ล่าสุดที่กล่องเจ้าของ Tasks ทุกคน\n- เพิ่มเจ้าของ Tasks สามารถ Upload File หรือรูป 1 ไฟล์ ไม่เกิน 10MB\n---\n[24 มิ.ย. 2569 08:25] มีการปรับแก้ส่วนที่คุยกับ API บน Cloud ปรับแก้ให้ทำงานเร็วขึ้น\n---\n[23 มิ.ย. 2569 06:25] ช่วงการ รีวิว การทำงาน\n---\n[22 มิ.ย. 2569 22:04] ย้ายขึ้น Hostinger แล้ว\n	\N	83	2026-06-22 12:26:08.041	2026-07-01 14:17:19.664	Oat (Chaiwat)/IT	\N	WorkSync เสร็จ Phase #1 เพิ่มฟังก์ชั่น Archive หลังจากที่ Task Done แล้ว และสามารถเรียกกลับมาทีหลังได้	t
63fcc317-7c19-4b8e-8840-3e45b684c0eb	Action Plan PM Computer	ทำความสะอาดคอมพิวเตอร์	in_progress	medium	90	2026-07-05 05:00:00		["Sense (Thanaphat)/IT", "Pu (Phuwit)/IT"]	acac3bc5-4f75-41a3-b34d-4fbfa4c20e2f	\N	Oat (Chaiwat)/IT	70	2026-06-23 07:26:51.122	2026-07-02 07:59:56.184	Boy (Nakprat)/IT	Oat (Chaiwat)/IT	\N	f
921f3d75-b8e5-40d6-9f6f-e7c50d739b8d	MFA Gateway	Linux Server สำหรับการ \n 1. Authentication กับ AD ภายใน \n 2. Application Gateway สำหรับเป็น Proxy จาก CloudFlare ไปคุยกับ API ของ SAP B1	in_progress	medium	39	2026-06-30 05:00:00		["Boy (Nakprat)/IT"]	c3674215-02a0-437f-bf8c-01d88623cf9d	[1 ก.ค. 2569 16:24] ทำ Connection บน CloudFlare แล้ว ยังติดปัญหาทำ Filter ที่ Server\n	\N	0	2026-06-27 04:38:30.284	2026-07-01 09:24:31.486	Oat (Chaiwat)/IT		\N	f
83506577-9acd-42b2-82be-c0f5c567e29e	MFA Active Directory	เพิ่ม MFA ใน Active Directory โดยใช้ยืนยันผ่าน Telegram	in_progress	medium	50	2026-08-03 05:00:00		[]	acac3bc5-4f75-41a3-b34d-4fbfa4c20e2f	[2 ก.ค. 2569 15:02] Phase แรกของ WA รอพี่โอ๊ตประกาศให้ User WA ติดตั้ง Telegram และขอเลข Telegram มาบันทึก\n---\n[2 ก.ค. 2569 15:01] MFA แบ่งของ WA-Shop เป็น Phase 2 ตอนนี้ Join Domain ไว้ก่อน\n---\n[25 มิ.ย. 2569 10:25] กำลังติดตั้ง Telegram และ Join Domain ให้กับสาขาที่ยังไม่ได้ทำ ของ WA-Shop\n---\n[25 มิ.ย. 2569 10:24] สร้าง Group WA-Shop MFA (ใช้เบอร์ HR) และสร้าง User Telegram WA-Shop แต่ละสาขา และเอาเลข Telegram ของ WA-Shop มาใส่ในช่อง Pager ของ AD เสร็จแล้ว\n[attachment:/uploads/task-83506577-9acd-42b2-82be-c0f5c567e29e-1782357892034-Screenshot_2026_06_22_152505.png|name:Screenshot 2026-06-22 152505.png]\n---\n[25 มิ.ย. 2569 10:23] ทำแผนการติดตั้งเสร็จแล้ว\n[attachment:/uploads/task-83506577-9acd-42b2-82be-c0f5c567e29e-1782357796121-Screenshot_2026_06_20_114326.png|name:Screenshot 2026-06-20 114326.png]\n	Oat (Chaiwat)/IT	20	2026-06-25 03:02:43.597	2026-07-02 08:02:59.765	Boy (Nakprat)/IT	Oat (Chaiwat)/IT	\N	f
b356046d-a97a-4602-bc3f-81f00849bdd7	Register Item Code System	ระบบ Gen รหัส (เส้นเต็ม,เส้นตัด)	review	medium	90	2026-06-30 05:00:00		[]	1989c8e9-66d8-4425-8d69-13d75a4fbbe4	[6 ก.ค. 2569 11:08] Present สอนการเข้าใช้งานกับผู้ที่เกี่ยวข้อง\n[attachment:/uploads/task-b356046d-a97a-4602-bc3f-81f00849bdd7-1783310920248-Screenshot_2026_07_06_110827.png|name:Screenshot 2026-07-06 110827.png]\n---\n[4 ก.ค. 2569 15:54] Deploy ขึ้น Server 12.254 เรียบร้อย ตั้ง Task Run Pooling Test แล้ว สามารถใช้งานได้ ทุกอย่างโอเคร\n---\n[2 ก.ค. 2569 16:15] Present ให้ ACC แล้ว มีการปรับแก้ไข 2 อย่าง 1.ปรับความหนาของเส้นเต็ม ให้ใส่จุดทษนิยม 2.เพิ่ม Description ส่งใน Telegram ในส่วนของพี่โบกี้ แก้ไข จบแล้ว ทั้ง 2 อย่าง\n[attachment:/uploads/task-b356046d-a97a-4602-bc3f-81f00849bdd7-1782983698238-Screenshot_2026_07_02_161402.png|name:Screenshot 2026-07-02 161402.png]\n---\n[1 ก.ค. 2569 13:58] ปรับแก้ไขโคดให้คิดคำนวณทศนิยมด้วย ตอนนี้ได้ราคาที่ตรงกับทาง ACC แล้ว\n---\n[25 มิ.ย. 2569 09:50] ราคาที่แสดงอยู่ล่าสุด ยังรอการยืนยันวิธีคืดว่า ถูกต้อง สมบูรณ์ มั้ย\n[attachment:/uploads/task-b356046d-a97a-4602-bc3f-81f00849bdd7-1782355807858-Screenshot_2026_06_25_094912.png|name:Screenshot 2026-06-25 094912.png]\n---\n[25 มิ.ย. 2569 09:45] ทำถึงคิดราคาต้นทุน(เส้นตัด) แสดงรายละเอียดต่างๆ\n---\n[24 มิ.ย. 2569 11:00] ตอนนี้ทำถึงเส้น (เส้นเต็ม,เส้นตัด)\n	Bowkie ACC	80	2026-06-23 07:26:40.656	2026-07-06 04:08:40.731	Sense (Thanaphat)/IT	Oat (Chaiwat)/IT	\N	f
5ed1ce0a-7adc-459b-851e-93ebe5f1f2f6	WorkSync	ปรับเพิ่ม Feature ใหม่ๆ	in_progress	medium	10	\N		["Sense (Thanaphat)/IT", "Boy (Nakprat)/IT"]	c3674215-02a0-437f-bf8c-01d88623cf9d	\N	\N	0	2026-07-03 01:58:22.344	2026-07-03 01:58:22.344	Oat (Chaiwat)/IT		\N	f
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: worksync
--

COPY public.users (id, email, username, password, nickname, first_name, last_name, status, role, department, "position", avatar_url, telegram_id, pin_code, is_ad_auth, devices, last_access, created_at, updated_at) FROM stdin;
c3674215-02a0-437f-bf8c-01d88623cf9d	chaiwat.n@windowasia.com	Chaiwat.N	$2b$10$Qw1ZWbyrWOfuqzA4lJWGZ./kXZ2T44Xhio58x1HnlKRFGRaA1Cp9q	Oat	Chaiwat	Nilawan	active	USER	IT	Manager	/uploads/avatar-c3674215-02a0-437f-bf8c-01d88623cf9d.png	7656347433	$2b$10$VTG8roey0sdzKArneXeq5e6cvKIWaBCMNQmEWiJWQxFTsI0Uz07Ey	t	["zxgpk7jmn9mqp6kx21", "dggvy4cwbl9mqp6xccj", "y1as8gy6y1mqpc3rcg", "1uqyhwcd2qsmqpceira", "0pygeb5dy87rmqpue31c", "ouziy10gyrmqqb6wic", "gjowddojxhmqpbzsyu", "nv9rul1qxygmqrh5t73", "rwc8jzq9mremr1prfx4"]	2026-07-07 15:14:06.716	2026-06-22 12:20:06.82	2026-07-07 15:14:06.718
1989c8e9-66d8-4425-8d69-13d75a4fbbe4	\N	Thanaphat.C	$2b$10$s.i28GF6.IE71JTeQ5DFKuD1jM5BhAFVVEvGhDHBJD4tP.DE5oSoi	Sense	Thanaphat	Chaernongprang	active	USER	IT	Staff	\N	8113265887	$2b$10$iZWqi4D2fe3U/jjrgI1yXe3SHhRwo2jUDbxDKV93jLPsrnzN4brHm	t	["6agj0uoiyyfmqqb6z5d", "iz1qrk725zbmqqbe3r1", "t8271n71l2fmqqgzz17"]	2026-07-06 04:07:33.896	2026-06-22 12:23:57.034	2026-07-06 04:07:33.899
1c4f6742-228e-412e-9204-abb2ede51516	admin@waapps.net	admin	$2b$10$5mDmbs9MSIU6aLT2aLG66.DFFThH8X8kYREyqCuiGgKyjIxp20RGK	\N	Admin	WorkSync	active	ADMIN	IT	Administrator	\N	\N	\N	f	["zxgpk7jmn9mqp6kx21", "y1as8gy6y1mqpc3rcg", "gjowddojxhmqpbzsyu"]	2026-07-06 04:46:37.474	2026-06-22 12:16:21.54	2026-07-06 04:46:37.475
0e00b141-3b3e-48a9-87a9-e50dfddf7f36	\N	Phuwit.S	$2b$10$A7K2.QD1dxGzsG/3DDg17uUemGsS4EwtOnPZOM2jHFXCIT57UfAjG	Pu	Phuwit	S	active	USER	IT	Staff	\N	7976035529	\N	t	["72hmp1bpscxmqrjmkys"]	2026-06-24 03:59:22.358	2026-06-24 02:15:46.843	2026-06-24 05:36:28.207
acac3bc5-4f75-41a3-b34d-4fbfa4c20e2f	\N	Nakprat.P	$2b$10$cb/VP3GP5cTlDf.ifSiVVex/f3yrxKM4ur/cAfyPF7lIhj9g4FxTG	Boy	Nakprat	Phaithun	active	USER	IT	Supervisor	/uploads/avatar-acac3bc5-4f75-41a3-b34d-4fbfa4c20e2f.jpeg	Nakprat.P	$2b$10$W1flxB23L4b6yOJg./99duPVZGYX2eVlFJI1SLiIV/AO9ZnBTcohS	t	["3vtw7d1srppmqqb7tum", "ktwcj6ytrqmqswrde7"]	2026-07-02 07:59:11.54	2026-06-22 12:22:53.269	2026-07-02 07:59:11.543
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_likes task_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_likes
    ADD CONSTRAINT task_likes_pkey PRIMARY KEY (id);


--
-- Name: task_reads task_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_reads
    ADD CONSTRAINT task_reads_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: task_likes_task_id_user_id_target_type_target_id_key; Type: INDEX; Schema: public; Owner: worksync
--

CREATE UNIQUE INDEX task_likes_task_id_user_id_target_type_target_id_key ON public.task_likes USING btree (task_id, user_id, target_type, target_id);


--
-- Name: task_reads_task_id_user_id_key; Type: INDEX; Schema: public; Owner: worksync
--

CREATE UNIQUE INDEX task_reads_task_id_user_id_key ON public.task_reads USING btree (task_id, user_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: worksync
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: worksync
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: task_comments task_comments_task_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_fkey FOREIGN KEY (task) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_likes task_likes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_likes
    ADD CONSTRAINT task_likes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_likes task_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_likes
    ADD CONSTRAINT task_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_reads task_reads_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_reads
    ADD CONSTRAINT task_reads_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_reads task_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: worksync
--

ALTER TABLE ONLY public.task_reads
    ADD CONSTRAINT task_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ltyMee4q9IfTeV4Y2SYh8LnRCJXIEdewmpRKlG7xE7yEfx0wmh2yVzLN2MIJnTs

