# Database Migration Path

`npm run db:migrate` runs `db/migrate.ts`. That script executes:

1. `db/schema.sql`
2. the explicit `db/migration-*.sql` list in `db/migrate.ts`

The top-level `migrations/` folder and `db/migrations/` folder are legacy or alternate migration sources. They are not executed by `npm run db:migrate` unless a file is copied or bridged into the explicit `db/migrate.ts` list.

## Current bridge

`db/migration-010-mvp-schema-gaps.sql` intentionally consolidates the non-destructive schema pieces that current APIs need from legacy top-level migrations:

- `migrations/0004_listings.sql`
- `migrations/0006_listings_pet_status.sql`
- `migrations/migration-010-premium.sql`

It runs before `db/migration-011-reviews.sql` because reviews reference `listings(id)`.

`db/migration-020-properties-pet-allowed.sql` is also registered in the active
path. It adds `properties.pet_allowed` and copies any legacy `listings` rows and
`photo_urls` into canonical `properties` / `property_images` records without
duplicating existing rows.

## Rules

- Add new production migrations under `db/` and register them in `db/migrate.ts`.
- Keep bridge migrations idempotent with `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.
- Do not delete or rewrite legacy migration files unless a separate cleanup task confirms no deployment path still consumes them.
