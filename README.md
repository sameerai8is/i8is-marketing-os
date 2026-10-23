# I8IS Marketing OS

Internal autonomous AI marketing operating system for I8IS, with I8IS as the first tenant.

## Product direction

A central Marketing Brain will coordinate specialized research, strategy, content, creative, publishing, analytics, and optimization agents. The dashboard and MongoDB data layer are the first prototype milestone.

- Ground strategy and generated content in a verified company knowledge base; distinguish verified facts from assumptions and never present invented company facts as verified.
- Support onboarding with business goals and connected Facebook, Instagram, and LinkedIn accounts.
- Keep publishing simulated in the prototype. Introduce Buffer as the first publishing adapter behind a provider gateway, leaving room for direct Meta and LinkedIn adapters.
- Design future persistence and API work around tenant isolation, with I8IS as the first tenant. The current models and content API do not yet enforce tenant isolation.
- Add durable background jobs and LangGraph-style orchestration later. Social OAuth will use an application-owned flow, without requiring customer developer apps.

The current UI uses sample data. Agent orchestration, social OAuth, provider integrations, tenant enforcement, and verified knowledge workflows are planned capabilities rather than implemented features.

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
