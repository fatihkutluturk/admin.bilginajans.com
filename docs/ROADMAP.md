# SEO Pilot — Product Roadmap

## Vision

SEO Pilot is a two-part product for WordPress agencies:

1. **SEO Pilot Dashboard** (this app) — SEO research, tracking, analytics, and content management
2. **Elementor MCP Plugin** (installed on client sites) — AI-powered site editing via Claude/Cursor/any MCP client

The dashboard handles strategy. The MCP plugin handles execution. Clients can edit their own sites with natural language through their preferred AI tool.

---

## What's Built (v1)

### SEO Engine
- [x] SerpBear integration (keyword rank tracking, GSC data)
- [x] SEO Dashboard with tabs: Overview, Rankings, Competitors, Performance, Insights
- [x] Google Search Console analytics (clicks, impressions, CTR, position)
- [x] Competitor analysis from SERP data with tracked competitors
- [x] PageSpeed Insights performance comparison
- [x] Keyword research (Gemini AI + SerpBear volume enrichment)
- [x] Automation status and framing throughout

### Content Management
- [x] Pages/Posts CRUD via WordPress REST API
- [x] Elementor widget text editing + AI content generation
- [x] AI-powered image auto-find (Gemini search terms + Unsplash)
- [x] Template management
- [x] Blog writer (3-step: research → template → create)
- [x] Content audit / site scan

### Infrastructure
- [x] Hash-based URL routing (bookmarkable pages)
- [x] localStorage state persistence across navigation
- [x] Docker deployment with persistent volume
- [x] Turkish translations throughout
- [x] SEO Pilot branding with automation positioning

---

## What's Removed (v1.1)

- [x] AI Chat (replaced by Elementor MCP plugin for editing)
- [x] Chat-based Elementor editing tools (clone_element, update_elementor_styles)
- [x] Tool declarations and chat-specific Gemini functions
- [x] Confirmation card and message bubble components

---

## Roadmap

### v1.2 — MCP Integration Guide
- [ ] In-app guide page explaining how to install Elementor MCP plugin
- [ ] MCP config generator (outputs .mcp.json for Claude/Cursor)
- [ ] Connection test button (verify MCP plugin is reachable)
- [ ] Link to MCP from Settings page

### v1.3 — Multi-Site Support
- [ ] Multiple WordPress site connections in Settings
- [ ] Site switcher in header
- [ ] Per-site SerpBear configuration
- [ ] Unified SEO dashboard across sites

### v1.4 — Automated Reports
- [ ] Weekly SEO report generation (AI summary of ranking changes)
- [ ] Email delivery of reports to client stakeholders
- [ ] PDF export for reports
- [ ] Scheduled keyword research suggestions

### v1.5 — Content Pipeline
- [ ] Content calendar with planned posts
- [ ] Draft → Review → Publish workflow
- [ ] AI content brief generator from keyword research
- [ ] Bulk content generation from keyword clusters

### v2.0 — SaaS Platform
- [ ] Multi-tenant architecture (multiple agencies)
- [ ] User authentication and roles
- [ ] Billing/subscription management
- [ ] White-label option for agencies
- [ ] API for third-party integrations

---

## Architecture

```
┌─────────────────────────────────┐
│  SEO Pilot Dashboard (Next.js)  │
│  - SEO tracking & analytics     │
│  - Content management           │
│  - Keyword research             │
│  - Performance monitoring       │
└──────────┬──────────────────────┘
           │ REST API
┌──────────┴──────────────────────┐
│  WordPress Site                  │
│  ├── REST API (pages, posts)    │
│  ├── SerpBear (rank tracking)   │
│  └── Elementor MCP Plugin ──────┤
│       97 AI-ready tools          │
└──────────┬──────────────────────┘
           │ MCP Protocol
┌──────────┴──────────────────────┐
│  AI Client (Claude/Cursor/etc)   │
│  Natural language site editing   │
└─────────────────────────────────┘
```
