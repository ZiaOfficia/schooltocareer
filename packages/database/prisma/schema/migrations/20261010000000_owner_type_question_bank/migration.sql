-- Question bank, part 1 of 2: two new OwnerType values.
--
-- QUESTION and EXAM_CHAPTER let the polymorphic tables (SlugHistory,
-- SearchDocument, OutboxEvent, FaqItem…) refer to questions and exam chapters
-- once those modules write to them. Nothing writes them yet.
--
-- A file of its own for the reason given in 20260903120000: PostgreSQL forbids
-- USING an enum value in the transaction that adds it, and migrate deploy wraps
-- each file in one. Anything that writes these values must come later.
--
-- Hand-written and additive; apply with `migrate deploy`, per
-- tooling/scripts/guard-migrate-dev.mjs.

ALTER TYPE "OwnerType" ADD VALUE IF NOT EXISTS 'QUESTION';
ALTER TYPE "OwnerType" ADD VALUE IF NOT EXISTS 'EXAM_CHAPTER';
