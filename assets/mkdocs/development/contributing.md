---
title: "Contributing"
weight: 1
---
# Contributing

## Getting Started

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/file-flux.git
cd file-flux

# 2. Install prerequisites
# Go 1.22+, Node.js 20+, just, Docker
brew install go node just docker

# 3. Setup
just setup

# 4. Start development
just dev
```

## Development Workflow

1. Create a feature branch from `develop`
2. Make changes with tests
3. Run `just check` (lint + test + typecheck)
4. Commit with conventional commit messages
5. Open a PR against `develop`

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, tagged releases only |
| `develop` | Integration branch for features |
| `feature/*` | Feature branches |
| `fix/*` | Bug fix branches |
| `release/*` | Release preparation |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(backend): add chunked file transfer engine
fix(agent): handle reconnection on network change
docs: update architecture overview
test(backend): add transfer service unit tests
chore: update Go dependencies
```

## Pull Request Checklist

- [ ] Tests pass (`just test`)
- [ ] Linting passes (`just lint`)
- [ ] TypeScript compiles (`just typecheck`)
- [ ] Documentation updated if needed
- [ ] Conventional commit messages used
- [ ] No secrets or credentials committed

## Project Structure

See [Architecture Overview](../architecture/overview.md) for component details.
