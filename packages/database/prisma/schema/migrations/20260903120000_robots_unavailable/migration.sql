-- Ingestion: separate "robots.txt says no" from "robots.txt could not be read".
--
-- The first cycle of Phase 0 recorded seven sources as BLOCKED_BY_ROBOTS,
-- including JEE Main, NEET and every CBSE page. None was actually disallowed:
-- five were 403s from an edge WAF that refuses non-browser clients, one was a
-- dead hostname, one a TLS certificate mismatch. The enum had no value that
-- could say so, so the report asserted a site decision nobody had made.
--
-- Hand-written and additive, for the reason given in 20260811001500: this
-- database holds objects Prisma does not model, and `migrate dev` would offer
-- to drop every one of them.
--
-- The backfill that USES this new value is a separate migration on purpose.
-- PostgreSQL allows ALTER TYPE ... ADD VALUE inside a transaction, but forbids
-- using the value until that transaction commits, and migrate deploy wraps
-- each file in one.

ALTER TYPE "FetchOutcome" ADD VALUE IF NOT EXISTS 'ROBOTS_UNAVAILABLE';

-- Carries the verbatim reason a check failed, so the review queue can say
-- "HTTP 403 fetching robots.txt" rather than showing a bare false.
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "robotsError" TEXT;
