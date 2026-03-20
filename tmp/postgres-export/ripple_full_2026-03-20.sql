--
-- PostgreSQL database dump
--

\restrict VGsVimYeW6Hc99EYQdfGgmysdAiOQEKePSEjrZKF4CWXjfrgchfJrdKo5On7eiT

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: genderenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.genderenum AS ENUM (
    'male',
    'female',
    'secret'
);


ALTER TYPE public.genderenum OWNER TO ripple;

--
-- Name: origintypeenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.origintypeenum AS ENUM (
    'original',
    'derivative',
    'repost'
);


ALTER TYPE public.origintypeenum OWNER TO ripple;

--
-- Name: pushstatusenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.pushstatusenum AS ENUM (
    'pending',
    'delivered',
    'viewed',
    'dismissed'
);


ALTER TYPE public.pushstatusenum OWNER TO ripple;

--
-- Name: ratingenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.ratingenum AS ENUM (
    'S',
    'A',
    'B',
    'C'
);


ALTER TYPE public.ratingenum OWNER TO ripple;

--
-- Name: roleenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.roleenum AS ENUM (
    'user',
    'admin'
);


ALTER TYPE public.roleenum OWNER TO ripple;

--
-- Name: skillstatusenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.skillstatusenum AS ENUM (
    'active',
    'hidden',
    'offline',
    'disabled'
);


ALTER TYPE public.skillstatusenum OWNER TO ripple;

--
-- Name: userstatusenum; Type: TYPE; Schema: public; Owner: ripple
--

CREATE TYPE public.userstatusenum AS ENUM (
    'active',
    'disabled'
);


ALTER TYPE public.userstatusenum OWNER TO ripple;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO ripple;

--
-- Name: ripple_pushes; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.ripple_pushes (
    id uuid NOT NULL,
    ripple_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    status public.pushstatusenum NOT NULL,
    delivered_at timestamp with time zone,
    viewed_at timestamp with time zone
);


ALTER TABLE public.ripple_pushes OWNER TO ripple;

--
-- Name: ripples; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.ripples (
    id uuid NOT NULL,
    skill_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ripples OWNER TO ripple;

--
-- Name: skill_comments; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.skill_comments (
    id uuid NOT NULL,
    skill_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skill_comments OWNER TO ripple;

--
-- Name: skill_versions; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.skill_versions (
    id uuid NOT NULL,
    skill_id uuid NOT NULL,
    version character varying(20) NOT NULL,
    changelog text,
    rating public.ratingenum,
    git_commit_sha character varying(40),
    author_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skill_versions OWNER TO ripple;

--
-- Name: skills; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.skills (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    display_name character varying(200) NOT NULL,
    description text NOT NULL,
    author_id uuid NOT NULL,
    recommendation text,
    origin_type public.origintypeenum NOT NULL,
    rating public.ratingenum NOT NULL,
    version character varying(20) NOT NULL,
    tags jsonb,
    category character varying(50),
    git_path character varying(500),
    status public.skillstatusenum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.skills OWNER TO ripple;

--
-- Name: user_skill_copies; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.user_skill_copies (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    command character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_skill_copies OWNER TO ripple;

--
-- Name: user_skill_downloads; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.user_skill_downloads (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    version character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_skill_downloads OWNER TO ripple;

--
-- Name: user_skill_likes; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.user_skill_likes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_skill_likes OWNER TO ripple;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ripple
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    nickname character varying(50),
    description character varying(200),
    gender public.genderenum,
    zodiac character varying(20),
    avatar_url character varying(500),
    tags jsonb,
    role public.roleenum NOT NULL,
    status public.userstatusenum NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO ripple;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.alembic_version (version_num) VALUES ('20260317_0002');


--
-- Data for Name: ripple_pushes; Type: TABLE DATA; Schema: public; Owner: ripple
--



--
-- Data for Name: ripples; Type: TABLE DATA; Schema: public; Owner: ripple
--



--
-- Data for Name: skill_comments; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.skill_comments (id, skill_id, author_id, parent_id, content, created_at, updated_at) VALUES ('4f6d9aa8-52f0-4e51-9824-ddb177f5dddf', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', NULL, '还是挺不错的', '2026-03-17 20:29:46.949692+08', '2026-03-17 20:29:46.949692+08');
INSERT INTO public.skill_comments (id, skill_id, author_id, parent_id, content, created_at, updated_at) VALUES ('ca0243ab-01b1-4776-a1ff-49fb7fd8638a', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '4f6d9aa8-52f0-4e51-9824-ddb177f5dddf', '我觉得你说的对', '2026-03-17 20:29:56.577217+08', '2026-03-17 20:29:56.577217+08');
INSERT INTO public.skill_comments (id, skill_id, author_id, parent_id, content, created_at, updated_at) VALUES ('faeb59ae-c052-444f-96c8-d85e10b8b9eb', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '4f6d9aa8-52f0-4e51-9824-ddb177f5dddf', '继续加油', '2026-03-17 20:30:02.62468+08', '2026-03-17 20:30:02.62468+08');
INSERT INTO public.skill_comments (id, skill_id, author_id, parent_id, content, created_at, updated_at) VALUES ('92c02965-25cc-4ad5-aadb-291403ef62c6', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', 'ca0243ab-01b1-4776-a1ff-49fb7fd8638a', '第三层级', '2026-03-17 20:30:09.272049+08', '2026-03-17 20:30:09.272049+08');
INSERT INTO public.skill_comments (id, skill_id, author_id, parent_id, content, created_at, updated_at) VALUES ('9bb9822c-4ccc-4722-9a95-8b4881434bb1', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', NULL, '建议再优化一下细节', '2026-03-17 20:30:29.852178+08', '2026-03-17 20:30:29.852178+08');


--
-- Data for Name: skill_versions; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.skill_versions (id, skill_id, version, changelog, rating, git_commit_sha, author_id, created_at) VALUES ('86eb86cf-bc7f-45b1-9a57-079ca8c9fb45', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '1.0.0', 'Initial seed import', 'B', NULL, '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skill_versions (id, skill_id, version, changelog, rating, git_commit_sha, author_id, created_at) VALUES ('aff47701-599c-417a-a9c2-3820bb1b162f', 'a8f484f0-0bb5-4ccd-bc2f-9e6fa4d6074c', '1.0.0', 'Initial seed import', 'B', NULL, '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skill_versions (id, skill_id, version, changelog, rating, git_commit_sha, author_id, created_at) VALUES ('0d051e4b-79ab-4628-9bec-05febe3e86f8', '938a730a-5e2b-4765-95cf-715632d3f114', '1.1.0', 'Initial seed import', 'B', NULL, '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skill_versions (id, skill_id, version, changelog, rating, git_commit_sha, author_id, created_at) VALUES ('ef61c7e5-0746-4e59-9336-460db5535f78', 'fdac427f-109c-445f-b006-0e15df834e38', '1.0.0', 'Initial version', 'B', '0ce70c39df3a671220abc09b66832f729adf0e72', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '2026-03-17 20:45:30.322496+08');


--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.skills (id, name, display_name, description, author_id, recommendation, origin_type, rating, version, tags, category, git_path, status, created_at, updated_at) VALUES ('13e3d1e5-5675-49b5-9964-b2a8200d9bde', 'skill-porting-engineer', 'Skill Porting Engineer', 'Port and adapt AI skills between different platforms and frameworks', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', NULL, 'original', 'B', '1.0.0', '["tools", "porting", "migration"]', 'tools', 'skills/tools/skill-porting-engineer', 'active', '2026-03-16 17:13:40.105599+08', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skills (id, name, display_name, description, author_id, recommendation, origin_type, rating, version, tags, category, git_path, status, created_at, updated_at) VALUES ('a8f484f0-0bb5-4ccd-bc2f-9e6fa4d6074c', 'engineering-backend-architect', 'Backend Architecture Designer', 'Design robust backend system architectures with best practices for scalability, reliability, and maintainability', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', NULL, 'original', 'B', '1.0.0', '["backend", "architecture", "system-design", "microservices"]', 'engineering', 'skills/engineering/engineering-backend-architect', 'active', '2026-03-16 17:13:40.105599+08', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skills (id, name, display_name, description, author_id, recommendation, origin_type, rating, version, tags, category, git_path, status, created_at, updated_at) VALUES ('938a730a-5e2b-4765-95cf-715632d3f114', 'github-create-pr', 'GitHub PR Creator', 'Automatically create well-structured pull requests with proper descriptions, labels, and reviewers', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', NULL, 'original', 'B', '1.1.0', '["github", "pull-request", "automation", "workflow"]', 'github', 'skills/github/github-create-pr', 'active', '2026-03-16 17:13:40.105599+08', '2026-03-16 17:13:40.105599+08');
INSERT INTO public.skills (id, name, display_name, description, author_id, recommendation, origin_type, rating, version, tags, category, git_path, status, created_at, updated_at) VALUES ('fdac427f-109c-445f-b006-0e15df834e38', 'delivery-bootstrap', 'delivery-bootstrap', 'Use when starting a new requirement in vesta-platform and you need to create the standard delivery directory and document set before clarification and technical design.', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '挺好用的，可以提高 vide coding 的效率', 'original', 'B', '1.0.0', '["工程"]', 'workflow', 'skills/workflow/delivery-bootstrap', 'active', '2026-03-17 20:45:30.322496+08', '2026-03-17 20:45:30.322496+08');


--
-- Data for Name: user_skill_copies; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.user_skill_copies (id, user_id, skill_id, command, created_at) VALUES ('8e9a328d-4a78-43b6-80b5-8699e53ecdd2', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '938a730a-5e2b-4765-95cf-715632d3f114', 'npx skills add https://github.com/org/ripple --skill github-create-pr', '2026-03-18 18:49:19.718885+08');


--
-- Data for Name: user_skill_downloads; Type: TABLE DATA; Schema: public; Owner: ripple
--



--
-- Data for Name: user_skill_likes; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.user_skill_likes (id, user_id, skill_id, created_at) VALUES ('e8471fae-f1dd-427f-964c-56f0027f5220', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '13e3d1e5-5675-49b5-9964-b2a8200d9bde', '2026-03-16 21:44:19.078488+08');
INSERT INTO public.user_skill_likes (id, user_id, skill_id, created_at) VALUES ('b24107b5-880f-4b37-8d7d-58e0cb0984be', '06652302-8b3a-4a6f-bac0-cfbc24d4c517', '938a730a-5e2b-4765-95cf-715632d3f114', '2026-03-16 21:59:44.740142+08');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ripple
--

INSERT INTO public.users (id, email, password_hash, nickname, description, gender, zodiac, avatar_url, tags, role, status, created_at, updated_at) VALUES ('06652302-8b3a-4a6f-bac0-cfbc24d4c517', 'admin@patpat.com', '$2b$12$tmNosoHLC83AltnZ5rTixOPBaZDXBrjO6D/CFA/M3mgT7fdMisVqK', 'Admin', NULL, NULL, NULL, NULL, '[]', 'admin', 'active', '2026-03-16 17:13:38.736249+08', '2026-03-16 17:13:38.736249+08');


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: ripple_pushes ripple_pushes_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripple_pushes
    ADD CONSTRAINT ripple_pushes_pkey PRIMARY KEY (id);


--
-- Name: ripples ripples_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripples
    ADD CONSTRAINT ripples_pkey PRIMARY KEY (id);


--
-- Name: skill_comments skill_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_comments
    ADD CONSTRAINT skill_comments_pkey PRIMARY KEY (id);


--
-- Name: skill_versions skill_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: ripples uq_sender_skill_ripple; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripples
    ADD CONSTRAINT uq_sender_skill_ripple UNIQUE (sender_id, skill_id);


--
-- Name: user_skill_copies uq_user_skill_copy; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_copies
    ADD CONSTRAINT uq_user_skill_copy UNIQUE (user_id, skill_id);


--
-- Name: user_skill_downloads uq_user_skill_download; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_downloads
    ADD CONSTRAINT uq_user_skill_download UNIQUE (user_id, skill_id);


--
-- Name: user_skill_likes uq_user_skill_like; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_likes
    ADD CONSTRAINT uq_user_skill_like UNIQUE (user_id, skill_id);


--
-- Name: user_skill_copies user_skill_copies_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_copies
    ADD CONSTRAINT user_skill_copies_pkey PRIMARY KEY (id);


--
-- Name: user_skill_downloads user_skill_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_downloads
    ADD CONSTRAINT user_skill_downloads_pkey PRIMARY KEY (id);


--
-- Name: user_skill_likes user_skill_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_likes
    ADD CONSTRAINT user_skill_likes_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_skill_comments_author_id; Type: INDEX; Schema: public; Owner: ripple
--

CREATE INDEX ix_skill_comments_author_id ON public.skill_comments USING btree (author_id);


--
-- Name: ix_skill_comments_skill_id; Type: INDEX; Schema: public; Owner: ripple
--

CREATE INDEX ix_skill_comments_skill_id ON public.skill_comments USING btree (skill_id);


--
-- Name: ix_skills_name; Type: INDEX; Schema: public; Owner: ripple
--

CREATE UNIQUE INDEX ix_skills_name ON public.skills USING btree (name);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: ripple
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ripple_pushes ripple_pushes_ripple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripple_pushes
    ADD CONSTRAINT ripple_pushes_ripple_id_fkey FOREIGN KEY (ripple_id) REFERENCES public.ripples(id);


--
-- Name: ripple_pushes ripple_pushes_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripple_pushes
    ADD CONSTRAINT ripple_pushes_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id);


--
-- Name: ripples ripples_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripples
    ADD CONSTRAINT ripples_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: ripples ripples_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.ripples
    ADD CONSTRAINT ripples_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: skill_comments skill_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_comments
    ADD CONSTRAINT skill_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: skill_comments skill_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_comments
    ADD CONSTRAINT skill_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.skill_comments(id);


--
-- Name: skill_comments skill_comments_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_comments
    ADD CONSTRAINT skill_comments_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: skill_versions skill_versions_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: skill_versions skill_versions_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: skills skills_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: user_skill_copies user_skill_copies_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_copies
    ADD CONSTRAINT user_skill_copies_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: user_skill_copies user_skill_copies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_copies
    ADD CONSTRAINT user_skill_copies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_skill_downloads user_skill_downloads_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_downloads
    ADD CONSTRAINT user_skill_downloads_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: user_skill_downloads user_skill_downloads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_downloads
    ADD CONSTRAINT user_skill_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_skill_likes user_skill_likes_skill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_likes
    ADD CONSTRAINT user_skill_likes_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id);


--
-- Name: user_skill_likes user_skill_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ripple
--

ALTER TABLE ONLY public.user_skill_likes
    ADD CONSTRAINT user_skill_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict VGsVimYeW6Hc99EYQdfGgmysdAiOQEKePSEjrZKF4CWXjfrgchfJrdKo5On7eiT

