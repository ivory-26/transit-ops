# Local setup

Follow these steps to run Transit Ops locally.

## Prerequisites

- Node.js 20.9 or newer
- Corepack (included with recent Node.js releases)
- Access to the project's Postgres/Neon database if you are working on database features

## Install dependencies

From the project directory:

```bash
corepack enable
pnpm install
```

## Configure environment variables

Create a `.env` file in the project root. Add the database connection string provided by the project owner or Neon:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

Do not commit `.env` or any file containing credentials. Environment files are ignored by Git.

`DATABASE_URL` is required when running Prisma commands. It may not be needed for pages that do not access the database.

## Generate the Prisma client

After installing dependencies, generate the client used by the application:

```bash
pnpm exec prisma generate
```

Run this again whenever the Prisma schema changes.

## Start the development server

```bash
pnpm dev
```

Open <http://localhost:3000> in a browser.

## Useful commands

```bash
pnpm lint      # Check the code with ESLint
pnpm build     # Create a production build
pnpm start     # Start the production build locally
```

## Troubleshooting

- If `pnpm` is not available, run `corepack enable` and try again.
- If Prisma reports a missing `DATABASE_URL`, check that `.env` is in the project root and contains a valid connection string.
- If dependencies appear out of sync, remove `node_modules` and run `pnpm install` again.
