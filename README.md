# AI agent setup

Windows snapshot of the global Claude Code and Codex setup, audited 2026-11-15.

## Files

| What | Repository path | Live location |
| --- | --- | --- |
| Claude global instructions | [CLAUDE.md](global/claude/CLAUDE.md) | %USERPROFILE%/.claude/CLAUDE.md |
| Codex global instructions | [AGENTS.md](global/codex/AGENTS.md) | %USERPROFILE%/.codex/AGENTS.md |
| Claude agents | [global/claude/agents](global/claude/agents) | %USERPROFILE%/.claude/agents |
| Codex agents | [global/codex/agents](global/codex/agents) | %USERPROFILE%/.codex/agents |
| Local workflow skills | [local-skills](local-skills) | %USERPROFILE%/.claude/skills and %USERPROFILE%/.agents/skills |
| Project instructions | [Noor and Nara](projects/noor-and-nara-demo) | Project root |
| Plugin and runtime inventory | [config](config) | Global app settings and project overrides |

## Recreate the setup

1. Install Claude Code and Codex, then sign in separately.
2. Copy each global instruction file and the matching agent definitions to the live locations above. Substitute the local Python install location where the global instructions refer to Python 3.13. Keep project instruction files in their own repository.
3. Register the third-party marketplaces listed below, then enable the matching plugin IDs using the [Claude JSON fragment](config/claude-plugins.json) and [Codex TOML fragment](config/codex-plugins.toml). Merge the fragments into the existing settings. OpenAI-provided plugins are managed by Codex.
4. Install the third-party skills listed below from their sources. Copy the local workflow skills to the matching client path. Claude's disabled skill folders are inventory only.
5. Use [runtime inventory](config/runtime-inventory.json) to review configured hooks and Codex MCP server names. Both clients run `reap-orphans.mjs` at session start and the Claude-installed Impeccable `scripts/hook.mjs` after file edits and at stop. Install [the orphan cleanup script](global/claude/scripts/reap-orphans.mjs) in `%USERPROFILE%/.claude/scripts`, then set the hook paths and permissions for the target machine.

No standalone ES-II SP1 instruction file was found in the checked workspace. Its project-level Codex config sets `notify`.

The snapshot covers the accessible Windows profile and checked local project folders. Gemini and Copilot config locations were present with no global instruction file found there. Ubuntu and other devices were outside this audit. Credentials, sessions, permissions, raw app settings, hook commands, plugin caches, and skill observation history were excluded. Third-party agent files are retained as local configuration copies and third-party skill packages are documented for reinstallation.

## Enabled plugins

A version denotes a locally installed or cached release. A dash means the plugin is outside that client's enabled list.

| Plugin ID | Claude | Codex | Use |
| --- | --- | --- | --- |
| `asd-ste100@asd-ste100-skill` | — | local | Controlled technical English and disambiguation. |
| `browser@openai-bundled` | — | 26.1111.21308 | Browser tab inspection and control. |
| `chrome@openai-bundled` | — | 26.1111.21308 | Connected Chrome interaction. |
| `codex-app-tools@openai-bundled` | — | 26.1111.21308 | Codex app operations and workspace integration. |
| `computer-use@openai-bundled` | — | 26.1111.21308 | Native Windows app control. |
| `documents@openai-primary-runtime` | — | 26.1112.11217 | Word document authoring and review. |
| `impeccable@impeccable` | — | 4.8.0 | Frontend design, interface audits, and visual polish. |
| `pdf@openai-primary-runtime` | — | 26.1112.11217 | PDF extraction, authoring, and verification. |
| `presentations@openai-primary-runtime` | — | 26.1112.11217 | Presentation authoring and review. |
| `spreadsheets@openai-primary-runtime` | — | 26.1112.11217 | Spreadsheet authoring, analysis, and live Excel work. |
| `superpowers@superpowers-dev` | 6.3.0 | 7.0.2 | Planning, implementation, debugging, and verification workflows. |
| `template-creator@openai-primary-runtime` | — | 26.1112.11217 | Turn reference artifacts into reusable templates. |
| `ui-ux-pro-max@ui-ux-pro-max-skill` | 2.13.0 | 2.15.0 | UI/UX research, branding, and design guidance. |
| `unified-computer-use@openai-bundled` | — | 26.1111.21308 | Unified browser and computer control. |
| `vibe-wise@vibe-wise` | — | 0.1.44 | Structured coding-agent guidance. |
| `visualize@openai-bundled` | — | 1.0.97 | Interactive visual explanations. |

### Third-party marketplaces

- `asd-ste100-skill` [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill)
- `impeccable` [pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- `superpowers-dev` [obra/superpowers](https://github.com/obra/superpowers)
- `ui-ux-pro-max-skill` [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- `vibe-wise` [nykooi1/vibe-wise](https://github.com/nykooi1/vibe-wise)

## Global agents

| Agent | Use | Definitions |
| --- | --- | --- |
| `impeccable-asset-producer` | Produces clean reusable raster assets from approved Impeccable mock references without redesigning the direction. | [Claude](global/claude/agents/impeccable-asset-producer.md) · [Codex](global/codex/agents/impeccable-asset-producer.toml) |
| `impeccable-documenter` | Records DESIGN.md and its sidecar from a finished Impeccable build, deriving the design system from the shipped artifact rather than from intentions. | [Claude](global/claude/agents/impeccable-documenter.md) · [Codex](global/codex/agents/impeccable-documenter.toml) |
| `impeccable-finish-reviewer` | Reviews a finished Impeccable build against its direction contract, the approved comp, and the chosen world's quality bar, returning an ordered list of material fixes. | [Claude](global/claude/agents/impeccable-finish-reviewer.md) · [Codex](global/codex/agents/impeccable-finish-reviewer.toml) |
| `impeccable-manual-edit-applier` | Applies leased Impeccable live manual copy-edit batches to source and returns canonical Apply results. | [Claude](global/claude/agents/impeccable-manual-edit-applier.md) · [Codex](global/codex/agents/impeccable-manual-edit-applier.toml) |
| `seo-backlinks` | Backlink profile analyst using free and paid sources. Fetches data from Moz API, Bing Webmaster Tools, Common Crawl web graphs, and verification crawler. Merges multi-source data… | [Claude](global/claude/agents/seo-backlinks.md) · [Codex](global/codex/agents/seo-backlinks.toml) |
| `seo-cluster` | Semantic topic clustering analysis using SERP overlap methodology. Expands seed keywords, performs pairwise SERP comparison, classifies intent, designs hub-and-spoke content… | [Claude](global/claude/agents/seo-cluster.md) · [Codex](global/codex/agents/seo-cluster.toml) |
| `seo-content` | Content quality reviewer. Evaluates E-E-A-T signals, readability, content depth, AI citation readiness, and thin content detection. | [Claude](global/claude/agents/seo-content.md) · [Codex](global/codex/agents/seo-content.toml) |
| `seo-dataforseo` | DataForSEO data analyst. Fetches live SERP data, keyword metrics, backlink profiles, on-page analysis, content analysis, business listings, and AI visibility checks via DataForSEO… | [Claude](global/claude/agents/seo-dataforseo.md) · [Codex](global/codex/agents/seo-dataforseo.toml) |
| `seo-drift` | SEO drift analysis agent. Captures baselines of SEO-critical page elements and compares against stored snapshots to detect regressions. Reports changes with severity… | [Claude](global/claude/agents/seo-drift.md) · [Codex](global/codex/agents/seo-drift.toml) |
| `seo-ecommerce` | E-commerce SEO analyst. Validates product schema, analyzes Google Shopping and Amazon marketplace visibility, identifies pricing gaps, and recommends product page optimizations.… | [Claude](global/claude/agents/seo-ecommerce.md) · [Codex](global/codex/agents/seo-ecommerce.toml) |
| `seo-flow` | FLOW framework prompt analyst. Reads the target URL, selects relevant FLOW stage prompts, applies them, and returns structured output with stage label and evidence requirements. | [Claude](global/claude/agents/seo-flow.md) · [Codex](global/codex/agents/seo-flow.toml) |
| `seo-geo` | GEO and AI search specialist. Analyzes AI crawler accessibility, llms.txt presence (optional; ignored by Google Search), passage-level citability, brand mention signals, and… | [Claude](global/claude/agents/seo-geo.md) · [Codex](global/codex/agents/seo-geo.toml) |
| `seo-google` | Google SEO API analyst. Fetches CWV field data via CrUX, indexation status via GSC, and organic traffic via GA4 for enriched audit data. | [Claude](global/claude/agents/seo-google.md) · [Codex](global/codex/agents/seo-google.toml) |
| `seo-image-gen` | SEO image analyst. Audits existing OG/social preview images, identifies missing or low-quality images, and creates an image generation plan with prompts for key pages. Does NOT… | [Claude](global/claude/agents/seo-image-gen.md) · [Codex](global/codex/agents/seo-image-gen.toml) |
| `seo-local` | Local SEO specialist. Analyzes GBP signals, NAP consistency, citations, reviews, local schema, location page quality, and industry-specific local factors for brick-and-mortar,… | [Claude](global/claude/agents/seo-local.md) · [Codex](global/codex/agents/seo-local.toml) |
| `seo-maps` | Maps intelligence specialist. Geo-grid rank tracking, GBP profile auditing, review intelligence, cross-platform NAP verification, and competitor radius mapping via DataForSEO and… | [Claude](global/claude/agents/seo-maps.md) · [Codex](global/codex/agents/seo-maps.toml) |
| `seo-performance` | Performance analyzer. Measures and evaluates Core Web Vitals and page load performance. | [Claude](global/claude/agents/seo-performance.md) · [Codex](global/codex/agents/seo-performance.toml) |
| `seo-schema` | Schema markup expert. Detects, validates, and generates Schema.org structured data in JSON-LD format. | [Claude](global/claude/agents/seo-schema.md) · [Codex](global/codex/agents/seo-schema.toml) |
| `seo-sitemap` | Sitemap architect. Validates XML sitemaps, generates new ones with industry templates, and enforces quality gates for location pages. | [Claude](global/claude/agents/seo-sitemap.md) · [Codex](global/codex/agents/seo-sitemap.toml) |
| `seo-sxo` | Search Experience Optimization analyst. Performs SERP backwards analysis to detect page-type mismatches, derives user stories from intent signals, and scores pages from multiple… | [Claude](global/claude/agents/seo-sxo.md) · [Codex](global/codex/agents/seo-sxo.toml) |
| `seo-technical` | Technical SEO specialist. Analyzes crawlability, indexability, security, URL structure, mobile optimization, Core Web Vitals, and JavaScript rendering. | [Claude](global/claude/agents/seo-technical.md) · [Codex](global/codex/agents/seo-technical.toml) |
| `seo-visual` | Visual analyzer. Captures screenshots, tests mobile rendering, and analyzes above-the-fold content using Playwright. | [Claude](global/claude/agents/seo-visual.md) · [Codex](global/codex/agents/seo-visual.toml) |

## Standalone skills

Codex and Claude have separate skill folders. Both labels mean the skill is present in both folders. Some copies have client-specific differences.

| Skill | Where found | Use | Source |
| --- | --- | --- | --- |
| `cms-migration` | Claude, Codex | Migrate a static site's content layer or admin between CMSes (Decap → Sveltia, Netlify CMS → Decap, headless CMS swaps) or adopt a pre-1.0 content tool. Covers choosing which… | — |
| `competitor-profiling` | Claude, Codex | When the user wants to research, profile, or analyze competitors from their URLs. Also use when the user mentions 'competitor profile,' 'competitor research,' 'competitor… | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) |
| `content-strategy` | Claude, Codex | When the user wants to plan a content strategy, decide what content to create, or figure out what topics to cover. Also use when the user mentions "content strategy," "what should… | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) |
| `copywriting` | Claude, Codex | When the user wants to write, rewrite, or improve marketing copy for any page — including homepage, landing pages, pricing pages, feature pages, about pages, or product pages.… | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) |
| `design-brief` | Claude, Codex | Create a design brief through an interactive interview, codebase exploration, and experience design decisions. Saved as a markdown file in the project. Use when user wants to… | [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills) |
| `find-skills` | Claude, Codex | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending… | [vercel-labs/skills](https://github.com/vercel-labs/skills) |
| `grilling` | Claude, Codex | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases. | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `imagegen` | Codex system | Generate or edit raster images when the task benefits from AI-created bitmap visuals such as photos, illustrations, textures, sprites, mockups, or transparent-background cutouts.… | — |
| `impeccable` | Claude, Codex | Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend… | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) |
| `information-architecture` | Claude, Codex | Define the structural layer of a product or site before visual design begins. Covers navigation, content hierarchy, page structure, URL patterns, and user flows. Use when user… | [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills) |
| `openai-docs` | Codex system | API first-timers, Codex/Work Q&A. If the user already has an OpenAI API integration, skip this skill for API questions and use the developer docs. Read this skill before answering… | — |
| `review-agent` | Codex system | Perform a read-only, defect-first review of a specified code change and return every actionable finding. Use when another agent delegates review of uncommitted changes, a… | — |
| `seo` | Claude, Codex | Comprehensive SEO analysis for any website or business type. Full site audits, single-page analysis, technical SEO (crawlability, indexability, Core Web Vitals with INP), schema… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-ahrefs` | Claude disabled | Ahrefs API analyst (extension). Reads referring domains, backlinks, organic keywords, and content explorer data via the tested @ahrefs/mcp@0.0.11 server. Pairs with seo-backlinks… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-audit` | Claude, Codex | Full website SEO audit with parallel subagent delegation. Crawls up to 500 pages, detects business type, delegates to up to 15 specialists (8 always + 7 conditional), generates… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-backlinks` | Claude, Codex | Backlink profile analysis: referring domains, anchor text distribution, toxic link detection, competitor gap analysis. Works with free APIs (Moz, Bing Webmaster, Common Crawl) and… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-bing` | Claude disabled | Bing Webmaster Tools + IndexNow extension. Microsoft Copilot citations are fed by the Bing index; this skill makes Bing visibility, link data, and IndexNow URL submission… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-cluster` | Claude, Codex | SERP-based semantic topic clustering for content architecture planning. Groups keywords by actual Google SERP overlap (not text similarity), designs hub-and-spoke content clusters… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-competitor-pages` | Claude disabled | Generate SEO-optimized competitor comparison and alternatives pages. Covers "X vs Y" layouts, "alternatives to X" pages, feature matrices, schema markup, and conversion… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-content` | Claude, Codex | Content quality and E-E-A-T analysis with AI citation readiness assessment. Use when user says "content quality", "E-E-A-T", "content analysis", "readability check", "thin… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-content-brief` | Claude, Codex | Generate competitive SEO content briefs with per-section word counts, competitor scoring, keyword density guidance, and page-type templates. Supports both new page briefs and… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-dataforseo` | Claude, Codex | Live SEO data via DataForSEO MCP server: SERP analysis, keyword research (volume, difficulty, intent, trends), backlink profiles, on-page analysis, competitor and content… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-drift` | Claude, Codex | SEO drift monitoring: capture baselines of SEO-critical elements, detect changes, and track regressions over time. Git for SEO: baseline, diff, and track changes to your on-page… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-ecommerce` | Claude, Codex | E-commerce SEO analysis: Google Shopping visibility, Amazon marketplace intelligence, product schema validation, competitor pricing analysis, and marketplace keyword gaps.… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-firecrawl` | Claude disabled | Full-site crawling, scraping, and site mapping via Firecrawl MCP. Use when user says "crawl site", "map site", "full crawl", "find all pages", "broken links", "site structure",… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-flow` | Claude, Codex | FLOW framework integration: evidence-led SEO using the Find → Leverage → Optimize → Win loop. Surfaces stage-specific AI prompts from the FLOW knowledge base (41 prompts, CC BY… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-geo` | Claude, Codex | Optimize content for AI Overviews (formerly SGE), ChatGPT web search, Perplexity, and other AI-powered search experiences. Generative Engine Optimization (GEO) analysis including… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-google` | Claude, Codex | Google SEO APIs: Search Console (Search Analytics, URL Inspection, Sitemaps), PageSpeed Insights v5, CrUX field data with 25-week history, Indexing API v3, and GA4 organic… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-hreflang` | Claude disabled | Hreflang and international SEO audit, validation, and generation. Detects common mistakes, validates language/region codes, and generates correct hreflang implementations. Use… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-image-gen` | Claude, Codex | AI image generation for SEO assets: OG/social preview images, blog hero images, schema images, product photography, infographics. Powered by Gemini via nanobanana-mcp. Requires… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-images` | Claude, Codex | Image optimization analysis for SEO and performance. Checks alt text, file sizes, formats, responsive images, lazy loading, CLS prevention, image SERP rankings (via DataForSEO),… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-local` | Claude, Codex | Local SEO analysis covering Google Business Profile optimization, NAP consistency, citation health, review signals, local schema markup, location page quality, multi-location SEO,… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-maps` | Claude, Codex | Maps intelligence for local SEO: geo-grid rank tracking, GBP profile auditing via API, review intelligence across Google/Tripadvisor/Trustpilot, cross-platform NAP verification,… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-page` | Claude disabled | Deep single-page SEO analysis covering on-page elements, content quality, technical meta tags, schema, images, and performance. Use when user says "analyze this page", "check page… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-plan` | Claude disabled | Strategic SEO planning for new or existing websites. Industry-specific templates, competitive analysis, content strategy, and implementation roadmap. Use when user says "SEO… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-profound` | Claude disabled | Profound LLM citation tracker (extension). Time-series brand citation rates across ChatGPT, Perplexity, and other LLMs. Pairs with seo-seranking for triangulated AI visibility… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-programmatic` | Claude disabled | Programmatic SEO planning and analysis for pages generated at scale from data sources. Covers template engines, URL patterns, internal linking automation, thin content safeguards,… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-schema` | Claude, Codex | Detect, validate, and generate Schema.org structured data. JSON-LD format preferred. Use when user says "schema", "structured data", "rich results", "JSON-LD", or "markup". | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-seranking` | Claude disabled | SE Ranking AI visibility analyst (extension). Tracks AI Share-of-Voice across ChatGPT, Gemini, Perplexity, AI Overviews, and AI Mode in a single query. | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-sitemap` | Claude, Codex | Analyze existing XML sitemaps or generate new ones with industry templates. Validates format, URLs, and structure. Use when user says "sitemap", "generate sitemap", "sitemap… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-sxo` | Claude, Codex | Search Experience Optimization: reads Google SERPs backwards to detect page-type mismatches, derives user stories from search intent signals, and scores pages from multiple… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-technical` | Claude, Codex | Technical SEO audit across 9 categories: crawlability, indexability, security, URL structure, mobile, Core Web Vitals, structured data, JavaScript rendering, and IndexNow… | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `seo-unlighthouse` | Claude disabled | Multi-page Lighthouse audit via the MIT-licensed Unlighthouse CLI. Free-tier alternative to running PageSpeed against every URL on a site, no API quota burn, runs locally. | [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) |
| `shipping-artifact-verification` | Claude, Codex | Verify the thing that actually ships, not the thing that is convenient to test. Use when a build passes / tests are green / Lighthouse is 100 but the deployed site, the… | [Local files](local-skills/codex/shipping-artifact-verification) |
| `skill-creator` | Codex system | Create or update a Codex skill with appropriately scoped instructions and any needed supporting resources. | — |
| `skill-installer` | Codex system | Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a… | — |
| `superpowers-extras` | Claude, Codex | Supplements superpowers verification-before-completion, test-driven-development, writing-plans, executing-plans, subagent-driven-development, systematic-debugging, and… | [Local files](local-skills/codex/superpowers-extras) |
| `task-observer` | Claude, Codex | Monitors task execution for skill improvement opportunities. Use during ANY multi-step task, agentic workflow, or work session where the agent uses tools and produces… | [Local files](local-skills/codex/task-observer) |
| `vercel-react-best-practices` | Claude, Codex | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure… | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| `website-pipeline` | Claude, Codex | End-to-end pipeline for building local-business websites — demo sites for cold outreach and paid client sites. Covers discovery, research, IA, design direction selection, content,… | [Local files](local-skills/codex/website-pipeline) |

## Skills supplied by enabled plugins

| Skill | Plugin | Cached for | Use |
| --- | --- | --- | --- |
| `computer-use` | `computer-use` | Codex | Control Windows apps from ChatGPT |
| `documents` | `documents` | Codex | Create, edit, redline, and comment on `.docx`, Word, and Google Docs-targeted document artifacts inside the container, with a strict render-and-verify workflow. Use… |
| `impeccable` | `impeccable` | Codex | Use to design, redesign, critique, audit, polish or animate a frontend: websites, landing pages, dashboards, app UI, components, native iOS/Android screens, or a design system… |
| `pdf` | `pdf` | Codex | Read, create, inspect, render, and verify PDF files where visual layout matters, including fillable AcroForms. Use Poppler rendering plus Python tools such as reportlab,… |
| `presentations` | `presentations` | Codex | Read, create or edit PowerPoint or Google Slides decks. Use for presentation, slide deck, PowerPoint, PPT, PPTX, or Google Slides requests. |
| `excel-live-control` | `spreadsheets` | Codex | Control an open or active Microsoft Excel workbook through the ChatGPT add-in or connected session. Use when the user tags the Microsoft Excel app in Codex or follows up on an… |
| `spreadsheets` | `spreadsheets` | Codex | Use skill when user requests to create, modify, analyze, visualize, or work with spreadsheet files (`.xlsx`, `.xls`, `.csv`, `.tsv`) or Google Sheets with formulas, formatting,… |
| `brainstorming` | `superpowers` | Claude, Codex | You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design… |
| `diagnosing-superpowers` | `superpowers` | Codex | Use when a superpowers session went wrong and your human partner wants to know why — repeated work, ignored plans, stumbles, poor results, a skill that didn't fire, "it took too… |
| `dispatching-parallel-agents` | `superpowers` | Claude, Codex | Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies |
| `executing-plans` | `superpowers` | Claude, Codex | Use when you have a written implementation plan to execute in a separate session with review checkpoints |
| `finishing-a-development-branch` | `superpowers` | Claude, Codex | Use when implementation is complete, all tests pass, and you need to decide how to integrate the work |
| `receiving-code-review` | `superpowers` | Claude, Codex | Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and… |
| `requesting-code-review` | `superpowers` | Claude, Codex | Use when completing tasks, implementing major features, or before merging to verify work meets requirements |
| `subagent-driven-development` | `superpowers` | Claude, Codex | Use when executing implementation plans with independent tasks in the current session |
| `systematic-debugging` | `superpowers` | Claude, Codex | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes |
| `test-driven-development` | `superpowers` | Claude, Codex | Use when implementing any feature or bugfix, before writing implementation code |
| `using-git-worktrees` | `superpowers` | Claude, Codex | Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git… |
| `using-superpowers` | `superpowers` | Claude, Codex | Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions |
| `verification-before-completion` | `superpowers` | Claude, Codex | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any… |
| `writing-plans` | `superpowers` | Claude, Codex | Use when you have a spec or requirements for a multi-step task, before touching code |
| `writing-skills` | `superpowers` | Claude, Codex | Use when creating new skills, editing existing skills, or verifying skills work before deployment |
| `template-creator` | `template-creator` | Codex | Create or update a reusable personal Codex artifact-template skill. Use when the user invokes $template-creator or asks in natural language to create a reusable template from a… |
| `banner-design` | `ui-ux-pro-max` | Claude, Codex | Design banners for social media, ads, website heroes, creative assets, and print. Multiple art direction options with AI-generated visuals. Actions: design, create, generate… |
| `brand` | `ui-ux-pro-max` | Claude, Codex | Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activate for branded content, tone of voice, marketing assets, brand compliance, style… |
| `design` | `ui-ux-pro-max` | Claude, Codex | Comprehensive design skill: brand identity, design tokens, UI styling, logo generation (55 styles, Gemini or Atlas Cloud AI), corporate identity program (50 deliverables, CIP… |
| `design-system` | `ui-ux-pro-max` | Claude, Codex | Token architecture, component specifications, and slide generation. Three-layer tokens (primitive→semantic→component), CSS variables, spacing/typography scales, component specs,… |
| `slides` | `ui-ux-pro-max` | Claude, Codex | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies. |
| `ui-styling` | `ui-ux-pro-max` | Claude, Codex | Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. Use… |
| `ui-ux-pro-max` | `ui-ux-pro-max` | Claude, Codex | UI/UX design intelligence for web, mobile, and desktop. This skill should be used when designing, building, reviewing, or fixing interfaces, including pages, components, design… |
| `learn` | `vibe-wise` | Codex | Activate or resume learning-first development. You lead the design; Claude gives feedback, explains concepts, asks follow-ups, and writes the agreed code. |
| `reset` | `vibe-wise` | Codex | Back up this project's learning notes and restart onboarding after confirmation. Does not reset application code. |
| `visualize` | `visualize` | Codex | Create visualizations and interactive tools directly in conversation. Proactively use to show how something works; explore 'what happens when', 'what changes', or 'help me… |

## Connected Work apps

The current Work session exposed GitHub for repository operations, Gmail for email, Google Calendar for events, Google Contacts for contact lookup, Google Drive for files and native documents, Supabase for databases, Sites for websites, Library for files, Automations for scheduling, and Pets for animated companions. These are account-level capabilities.
