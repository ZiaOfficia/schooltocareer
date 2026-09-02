-- Reclassify the snapshots written by the conflating code path.
--
-- Every BLOCKED_BY_ROBOTS row that exists at this point was produced before
-- the classifier could tell the two cases apart, and the diagnosis behind
-- 20260903120000 established that none of them was a genuine disallow.
-- Leaving them would preserve a false claim inside the dataset Phase 1 is
-- meant to reason over — and the entire argument for Phase 0 is that those
-- decisions get made against evidence.

UPDATE "SourceSnapshot"
   SET outcome = 'ROBOTS_UNAVAILABLE',
       error   = 'reclassified: written before the fetcher could distinguish a '
                 || 'robots disallow from an unreadable robots.txt'
 WHERE outcome = 'BLOCKED_BY_ROBOTS';

-- Clear the cached verdict so the corrected classifier re-checks on the next
-- poll instead of waiting out the weekly TTL.
UPDATE "Source"
   SET "robotsCheckedAt" = NULL,
       "robotsAllowed"   = NULL
 WHERE "robotsAllowed" IS FALSE;
