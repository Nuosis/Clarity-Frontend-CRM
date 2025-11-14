# Architect Mode - Project-Specific Architecture Rules

## Migration Architecture: FileMaker → Supabase
- **NEW FEATURES**: Design for Supabase-first architecture
- **LEGACY**: FileMaker integration remains for backward compatibility only
- Supabase client configured in src/config.js (supabaseUrl, supabaseAnonKey)
- Use `@supabase/supabase-js` for new data operations
- Dual environment architecture still exists but new features should target web app + Supabase

## Architectural Constraints Discovered
- Dual environment requirement: Must work in FileMaker WebViewer AND standalone web app (LEGACY)
- Single-file bundle constraint: Vite builds to one file via `vite-plugin-singlefile` for FileMaker
- State management split: Redux for proposals/documentation, custom hooks for everything else
- Services layer pattern: Business logic in src/services/, hooks coordinate, components consume

## Non-Standard Architecture Decisions
- Custom hooks for data fetching violates documented Redux-first approach (intentional)
- Backend API acts as FileMaker proxy, not independent REST API (LEGACY)
- Environment detection happens at runtime, not build time
- Auth mechanism differs by environment (FileMaker native vs HMAC-SHA256)

## Critical Coupling Points
- src/api/fileMaker.js is central integration point for both environments
- Backend expects `{ fields: data }` wrapper - breaking change if removed
- FileMaker layouts hardcoded with `dev` prefix throughout codebase
- Response format transformation in lines 189-208 of src/api/fileMaker.js

## Performance Bottlenecks
- Single-file bundle can become large (no code splitting in FileMaker mode)
- jspdf library requires special Jest configuration (transformIgnorePatterns)
- Vite proxy adds latency in dev mode (routes through backend)
- HMAC signature calculation happens on every backend API call

## Deployment Architecture
- FileMaker deployment uses `fmp://` protocol to trigger import
- Upload script (scripts/upload.js) reads from dist/index.html
- No traditional CI/CD - manual build and upload to FileMaker
- Dev server on port 1235 (not standard 3000) to avoid conflicts