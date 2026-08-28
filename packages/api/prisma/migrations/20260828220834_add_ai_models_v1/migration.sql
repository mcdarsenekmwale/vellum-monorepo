CREATE TYPE AiActivityStatus AS ENUM ('SUCCESS', 'STREAM_TRUNCATED', 'ERROR', 'RATE_LIMITED', 'AUTH_FAILED');
CREATE TYPE AiPlacement AS ENUM ('WEB_PROFILE', 'MOBILE_NAV', 'ADMIN_FAB', 'ADMIN_QUICK');
--
-- PostgreSQL database dump
--

\restrict DBsUVnMQaGhjWVtTVkEvkhnFMPltMdMd2wyqHU1w8zYSHsfU00An3h8Cdm5c4Ga

-- Dumped from database version 16.14 (Homebrew)
-- Dumped by pg_dump version 16.14 (Homebrew)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_activities; Type: TABLE; Schema: public; Owner: mcdarsenemwale
--

CREATE TABLE public.ai_activities (
    id text NOT NULL,
    "userId" text NOT NULL,
    "conversationId" text,
    placement public."AiPlacement" NOT NULL,
    "contextTag" text,
    model text NOT NULL,
    "inputTokens" integer,
    "outputTokens" integer,
    "durationMs" integer NOT NULL,
    "toolInvocations" jsonb,
    messages jsonb NOT NULL,
    status public."AiActivityStatus" NOT NULL,
    "errorCode" text,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ai_activities OWNER TO mcdarsenemwale;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: mcdarsenemwale
--

CREATE TABLE public.ai_conversations (
    id text NOT NULL,
    "userId" text NOT NULL,
    placement public."AiPlacement" NOT NULL,
    title text DEFAULT 'New conversation'::text NOT NULL,
    "lastMessageAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ai_conversations OWNER TO mcdarsenemwale;

--
-- Name: ai_activities ai_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: mcdarsenemwale
--

ALTER TABLE ONLY public.ai_activities
    ADD CONSTRAINT ai_activities_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: mcdarsenemwale
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_activities_placement_createdAt_idx; Type: INDEX; Schema: public; Owner: mcdarsenemwale
--

CREATE INDEX "ai_activities_placement_createdAt_idx" ON public.ai_activities USING btree (placement, "createdAt");


--
-- Name: ai_activities_status_createdAt_idx; Type: INDEX; Schema: public; Owner: mcdarsenemwale
--

CREATE INDEX "ai_activities_status_createdAt_idx" ON public.ai_activities USING btree (status, "createdAt");


--
-- Name: ai_activities_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: mcdarsenemwale
--

CREATE INDEX "ai_activities_userId_createdAt_idx" ON public.ai_activities USING btree ("userId", "createdAt");


--
-- Name: ai_conversations_userId_placement_lastMessageAt_idx; Type: INDEX; Schema: public; Owner: mcdarsenemwale
--

CREATE INDEX "ai_conversations_userId_placement_lastMessageAt_idx" ON public.ai_conversations USING btree ("userId", placement, "lastMessageAt");


--
-- Name: ai_activities ai_activities_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcdarsenemwale
--

ALTER TABLE ONLY public.ai_activities
    ADD CONSTRAINT "ai_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_conversations ai_conversations_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcdarsenemwale
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DBsUVnMQaGhjWVtTVkEvkhnFMPltMdMd2wyqHU1w8zYSHsfU00An3h8Cdm5c4Ga


