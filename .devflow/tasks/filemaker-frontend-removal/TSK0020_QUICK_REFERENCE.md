# TSK0020: Remove FileMaker Deployment Scripts - Quick Reference

## What Changed

### Removed Scripts
```bash
# ❌ No longer available
npm run upload
npm run build:upload
npm run deploy-to-fm
```

### Current Deployment Workflow
```bash
# ✅ Build for production
npm run build

# ✅ Deploy dist/index.html to web server
# Use your preferred deployment method:
# - FTP/SFTP
# - SSH/SCP
# - CI/CD pipeline
# - Cloud hosting (Vercel, Netlify, etc.)
```

## Files Modified
- `package.json` - Removed 3 scripts
- `CLAUDE.md` - Removed Deployment section

## Files Preserved (Legacy)
- `scripts/upload.js` - Historical reference only
- `widget.config.js` - Historical reference only

## Verification
```bash
npm run build
# ✅ Build passes: 2,117.99 kB (gzip: 616.61 kB)
```

## Migration for Users

If you were using `npm run deploy-to-fm`, you now need to:
1. Run `npm run build` to create production bundle
2. Deploy `dist/index.html` to your web hosting
3. Remove any local `widget.config.js` customizations
4. Update deployment automation/scripts

## Related Tasks
- TSK0019: Removed FileMaker env vars
- TSK0018: Removed fm-gofer dependency
- TSK0015: Simplified dataService routing
- TSK0021: Update CLAUDE.md (next)

## Status
✅ Complete - Build verified - No breaking changes
