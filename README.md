# I8IS Marketing OS

Internal autonomous AI marketing operating system for I8IS.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind
- MongoDB (via Mongoose)
- Lucide icons

## Getting started

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Requires Node.js 22.x and npm. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

The sample dashboard pages work without a database. To use `/api/content`, copy `.env.example` to `.env.local` and set `MONGODB_URI` to a running local MongoDB or MongoDB Atlas database. Missing or unreachable storage returns HTTP 503; invalid content requests return HTTP 400. No credentials are needed during the build.

## Production build and local deployment

```bash
npm ci
npm run check
npm start
```

The production server runs at http://localhost:3000. Use `npm start -- --port 3001` to select another port. `npm run check` runs ESLint, TypeScript, and a production build.

The lockfile includes a PostCSS override for Next.js so it uses the patched PostCSS 8 release. Production dependency auditing (`npm audit --omit=dev`) passes. The full audit still reports findings in the existing Tailwind 3 and ESLint tooling; resolving those requires a separate tooling upgrade.

## Deploy on Vercel

1. Import `sameerai8is/i8is-marketing-os` into Vercel and select the `main` branch.
2. Keep the root directory as the repository root and the framework as Next.js. `vercel.json` uses `npm ci` and `npm run build`; leave the output directory at its default.
3. Use Node.js 22.x (also specified in `package.json`).
4. For content persistence, set `MONGODB_URI` in Vercel's environment variables to a reachable MongoDB Atlas URI, with database network access configured for the deployment. Do not use a localhost URI on Vercel. Redeploy after changing environment variables.
5. Deploy. Pages can be deployed without `MONGODB_URI`; `/api/content` requires it at runtime.

This is an internal prototype with sample data. AI generation, publishing, and account connections are not implemented. The content API currently has no authentication; keep the deployment access restricted if you connect a private database.

## Current status
- Sidebar with 6 workspaces + Settings
- Command Center with strategy overview
- Content Calendar (month view with sample posts and status colors)
- Campaign Studio, Company Brain, Creative Studio, Performance Intelligence
- Mongoose models: ContentItem, Campaign, BrandProfile
- MongoDB connection helper

## Next steps
- Wire models to API routes and real data
- Publishing simulation + Buffer adapter
- Agent orchestration skeleton (LangGraph)
- Company website analysis flow
