# Skill catalogue

slipstream ships 63 Claude Code agent skills. Each is a `SKILL.md` with valid `name` and `description` frontmatter; each shipping skill carries a verification gate. Run `npx slipstream validate` to list them with live per-category counts.

## Shipping integrations

### frontend (7)
frontend-vite-react, frontend-tailwind, frontend-router, frontend-forms, frontend-component-library, frontend-responsive-layout, frontend-dark-mode

### backend (5)
backend-hono-api, backend-zod-validation, backend-error-handling, backend-rate-limit, backend-openapi

### supabase (7)
supabase-init, supabase-schema, supabase-rls, supabase-auth, supabase-storage, supabase-typegen, supabase-edge-function

### cloudflare (6)
cloudflare-worker, cloudflare-pages, cloudflare-d1, cloudflare-kv, cloudflare-r2, cloudflare-secrets

### vercel (4)
vercel-link, vercel-env, vercel-preview, vercel-deploy

### resend (4)
resend-setup, resend-domain, resend-transactional, resend-webhook

### auth (4)
auth-session, auth-oauth, auth-rbac, auth-password-reset

### payments (4)
payments-stripe-setup, payments-checkout, payments-subscriptions, payments-webhooks

### seo (4)
seo-meta-tags, seo-open-graph, seo-sitemap, seo-structured-data

### analytics (3)
analytics-plausible, analytics-events, analytics-web-vitals

### git (5)
git-init-repo, git-conventional-commit, git-feature-branch, git-pull-request, git-release-tag

## Discipline skills

### memory (3)
memory-capture, memory-recall, memory-prune

### context (7)
scoped-read, context-budget, compact-and-offload, think-before-coding, systematic-debugging, brainstorm-spec, write-plan

The last four are token-discipline workflow skills: `think-before-coding` (surface assumptions, keep changes minimal and surgical, define a verifiable success criterion before editing), `systematic-debugging` (a four-phase root-cause process that stops the guess-and-patch loop), `brainstorm-spec` (refine a vague request into an agreed written spec before coding), and `write-plan` (decompose agreed work into small, independently verifiable tasks).

## Verification gates by example

- `vercel-deploy` uses a `healthcheck` gate: it curls the production URL and requires a 200 before declaring the deploy healthy.
- `supabase-typegen` uses a `command` gate that regenerates types and checks they compile.
- `frontend-vite-react` uses a `build` gate.
- The `memory` and `context` skills carry no gate, because they manage retrieval and memory rather than producing a deployable artifact.

See [Writing a skill](Writing-a-Skill) to add your own, and [Integrations](Integrations) for how the integration skills fit a real deployment.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/slipstream)
