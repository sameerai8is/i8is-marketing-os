# I8IS Marketing OS

Internal autonomous AI marketing operating system for I8IS.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind
- MongoDB (via Mongoose)
- Lucide icons

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Set `MONGODB_URI` in `.env.local` (defaults to local MongoDB).

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
