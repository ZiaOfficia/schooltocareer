# Cross-module consistency review

Run at the end of Phase 5, before the admin UI starts depending on these APIs.

The question for every difference was **"is this caused by the domain, or by
inconsistent implementation?"** — not "does every module look identical".

Two accidental divergences were found and fixed. One of them was a data bug.

---

## Capability matrix

Derived by inspecting the source, not from memory.

| | Exam | Board | Category | Paper | Result | Blog | Media | Search |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Repository boundary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | uses provider's |
| DTO mapping | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Validation in `@stc/validation` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Permissions via `can()` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Domain events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| Cache-aside | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Search source | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | n/a |
| Slug history | ✓ | ✓ | ✓ | **✓ (fixed)** | ✓ | ✓ | — | n/a |
| Revisions | ✓ | ✓ | ✓ | ✓ | ✓ | **✓ (fixed)** | ✓ | n/a |
| Audit trail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | logged |
| Optimistic concurrency | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | n/a |
| Offset pagination | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cursor pagination | ✓ | ✓ | — | ✓ | — | ✓ | — | n/a |
| Faceting | — | — | — | ✓ | ✓ | ✓ | — | ✓ |
| Publish lifecycle | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | n/a |
| Restore | ✓ | ✓ | — | — | — | — | — | n/a |
| Error translation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Unit tests | 13 | 11 | 11 | 13 | 19 | 14 | 18 | 12 |

---

## ACCIDENTAL — found and fixed

### 1. Blog wrote every revision TWICE (data bug)

`AuditHandler` appends a `ContentRevision` whenever an event carries a snapshot
— that is how all seven modules get history. Blog **also** called
`revisions.append()` directly, so one save produced **two rows and consumed two
version numbers**. The revision list showed every edit duplicated, and
`@@unique([ownerType, ownerId, version])` was being burned twice as fast.

Nobody would have found this without diffing the modules against each other:
Blog's tests passed, because they asserted on the direct append it should not
have been making.

**Fix — one writer, intent on the event.** `DomainEvent` gained
`revisionType`, `rollbackOfVersion` and `changeNote`; `AuditHandler` honours
them. Blog's service no longer writes revisions at all, and its dependency is
now `Pick<RevisionRepository, 'listFor' | 'getSnapshot'>` — read-only, so the
mistake cannot recur by accident.

The tests now assert on the **event**, which is the thing that becomes a
revision, and one of them explicitly checks that a save emits exactly one event.

### 2. QuestionPaper had no `changeSlug` (missing capability + dead schema)

`questionPaperChangeSlugSchema` existed in `@stc/validation` and was exported
from the module's validation file — but there was no service method and no
route. Every other sluggable module had one.

Papers are indexed URLs with accumulated ranking. A rename without a
`SlugHistory` row and its redirects silently discards that ranking, which is
the exact failure the slug machinery exists to prevent.

**Fix:** implemented `changeSlug` on the service, wired the controller method
and the `POST /:id/change-slug` route behind `content:change-slug`, matching
every other module.

---

## PRINCIPLED — domain-driven, no change

| Divergence | Why it is correct |
|---|---|
| **Category has no publish lifecycle** | The schema gives it no `PublishStatus`. Taxonomy is not content; "draft category" is not a state an editor means. |
| **Category is not in site search** | It is crawlable and in the sitemap, but a search for "JEE" should return articles, not the category listing them. Encoded as `searchable: false` on the source. |
| **Media has no slug** | `publicId` is its stable identifier, and it has no public URL of its own — so there is nothing for `SlugHistory` to protect. |
| **Media has no public routes** | Assets are served by the storage CDN. The API never proxies bytes. |
| **Media is not cached** | Admin-only reads; the CDN caches the only thing users fetch. |
| **Search has no repository** | It owns no table. It reads through `ISearchProvider` and the source registry — a repository would be an empty layer. |
| **Blog uniquely owns `ContentDraft`** | It is the only module with long-form authoring where a browser crash loses real work. A paper's metadata form does not need autosave. |
| **Board uniquely cascades soft delete** | It is the only module whose children are separate tables (`BoardClass → BoardClassSubject → Chapter`). Category promotes children instead — also correct for a taxonomy, where cascading would silently unpublish articles. |
| **Faceting only on Paper / Result / Blog / Search** | These are the browse surfaces with enough rows for a filter panel to matter. Twenty boards need a list, not facets. |
| **Result's TTL varies with business state** | Uses the existing cache provider with a computed number. A page six months from declaration and the same page on declaration day cannot share one TTL. |

---

## ACCEPTED GAPS — deliberate, with a decision recorded

### `restore` exists only on Exam and Board

Category, QuestionPaper, Result, Blog and Media soft-delete without a restore
path, so an admin trash view could show rows it cannot recover.

**Decision: defer to Phase 6, implement uniformly.** It is a real gap, but it is
an *admin UI* capability with no consumer today, and the tombstone/reclaim logic
is identical in all five — implementing it now, untested against a real
database and unused by any screen, risks five copies of a subtly wrong reclaim.
Recorded here so it is a decision rather than an oversight.

### Cursor pagination missing on Result

Category (small taxonomy) and Media (admin table) are principled. **Result is
not**: results lists grow by ~hundreds per year and are publicly browsable, so
they will eventually hit deep offsets. Cheap to add; grouped with the restore
work.

### Media has no optimistic concurrency

Two editors renaming the same image's alt text could clobber each other.
Low-impact and low-contention, but inconsistent. Grouped with the above.

---

## Verification after the fixes

```
Typecheck            9/9 packages
Tests                122 passed (9 files)
Architecture metrics 5/5 PASS
Prisma schema        valid
Build                clean
```

---

## The remaining risk is operational, not architectural

**Nothing in this codebase has ever run against a real PostgreSQL database.**
All 122 tests use fakes. The following are *unexecuted SQL*:

- `FOR UPDATE SKIP LOCKED` in the outbox claim
- Three recursive CTEs with depth guards (Category)
- The generated `tsvector` column and its locale branch
- `NULLS NOT DISTINCT` identity indexes
- Every partial index (`WHERE deleted_at IS NULL`, `WHERE isCurrent = true`)
- `pg_trgm` similarity for autocomplete
- `groupBy` facet aggregation batched in one transaction

**Acceptance criteria before Phase 6**, as agreed:

1. `prisma migrate deploy` against a fresh Neon branch
2. `pnpm db:constraints` — the raw SQL that Prisma cannot express
3. Seed representative data from `@stc/constants`
4. One complete flow: create → commit → outbox row exists → worker claims it →
   cache tag purged → `SearchDocument` row written
5. Explicitly exercise the PostgreSQL-specific features listed above

That is the next task.
