---
title: "Code Style"
weight: 3
---
# Code Style

## Go (Backend + Agent)

### Formatting
- Use `gofmt` / `goimports` (enforced by CI)
- Line length: 120 characters soft limit

### Linting
- `golangci-lint` with default config
- Run: `just lint-backend` / `just lint-agent`

### Naming Conventions
- Exported names: `PascalCase`
- Unexported names: `camelCase`
- Interfaces: noun (e.g., `Repository`, `Storage`)
- Implementations: descriptive (e.g., `PostgresRepository`, `LocalStorage`)

### Error Handling
```go
// ✅ Good — wrap errors with context
if err != nil {
    return fmt.Errorf("failed to create job: %w", err)
}

// ❌ Bad — bare error return
if err != nil {
    return err
}
```

### Package Organization
- `internal/` for private packages
- No circular imports
- Dependencies point inward (Clean Architecture)

---

## TypeScript (Frontend)

### Formatting
- Prettier with default config
- 2-space indentation
- Single quotes
- Trailing commas

### Linting
- ESLint with `@typescript-eslint/recommended`
- Run: `just lint-frontend`

### Component Naming
- Custom element tag: `ff-component-name` (kebab-case, `ff-` prefix)
- Class name: `ComponentName` (PascalCase)
- File name: `component-name.ts` (kebab-case)

### Type Safety
```typescript
// ✅ Good — explicit types
@property({ type: String }) status: TransferStatus = 'pending';

// ❌ Bad — any or untyped
@property() status: any;
```

---

## Git

- Branch names: `feature/ticket-description`, `fix/issue-number`
- Commits: conventional commit format
- PRs: squash-merge into `develop`
- Releases: merge `develop` → `main`, tag with `v*`
