# GitHub Wiki Setup

This package contains a proposed GitHub Wiki information architecture for `mcdarsenekmwale/vellum-monorepo`.

## Why restructure?

The repository already has a large `CODE_WIKI.md` containing 15 major technical sections. The GitHub Wiki is better used as a navigable documentation site: concise landing page, domain pages, operational guides, examples and a persistent sidebar.

## Pages included

- Home
- Architecture
- Backend API
- Database
- Shared Packages
- Admin Dashboard
- Web App
- Mobile App
- Setup
- Deployment
- Webhooks
- AI Agents
- API Examples
- Testing
- Security
- Changelog
- `_Sidebar.md`
- `_Footer.md`

## Publish

GitHub Wikis are separate Git repositories. If the repository Wiki feature is enabled, clone the wiki repository and copy these files into it:

```bash
git clone https://github.com/mcdarsenekmwale/vellum-monorepo.wiki.git
cd vellum-monorepo.wiki
# Copy the generated .md files here
git add .
git commit -m "docs: restructure Vellbase GitHub Wiki"
git push
```

## Maintenance rule

Update the corresponding wiki page when a major architectural PR lands.

- API change → `Backend-API.md`
- Schema change → `Database.md`
- Client change → `Web-App.md` / `Mobile-App.md`
- Deployment change → `Deployment.md`
- Integration change → `Webhooks.md`
- Agent change → `AI-Agents.md`
- Test-baseline change → `Testing.md`
- Feature/deployment commit → `Changelog.md`

## Accuracy policy

These pages are based on the current repository README, `CODE_WIKI.md`, and `TESTING_REPORT.md`. Do not represent architecture recommendations as shipped features. When docs and code differ, verify against source files and package manifests.
