# pressure-twin-server

## Quick Start

On a new machine, run:

```bash
pnpm install
# pnpm prisma:generate (already in postinstall hook)
pnpm prisma:migrate
pnpm db:seed
pnpm dev
```

The `postinstall` script already runs `prisma generate`, so you usually do not need to run `pnpm prisma:generate` manually after `pnpm install`.

## Prisma Workflow

- `pnpm install`: install dependencies and automatically run `prisma generate`
- `pnpm prisma:migrate`: apply Prisma migrations and create/update database tables
- `pnpm db:seed`: run [prisma/seed.ts](./prisma/seed.ts) to insert initial data
- `pnpm dev`: start the development server

Run `pnpm prisma:generate` manually only when needed, for example after changing `prisma/schema.prisma` or upgrading `prisma` / `@prisma/client`.

## Notes

- This project uses SQLite.
- Prisma migration files live in [prisma/migrations](./prisma/migrations/).
- If `better-sqlite3` fails on a new environment, reinstall dependencies so its native build script can run correctly.
