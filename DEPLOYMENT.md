# Deployment Guide

## Environment Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- FileMaker Server
- Access to deployment environment
```

## Build Process

### Development Build
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

### Build Configuration

#### Vite Config (vite.config.js)
```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser'
  }
});
```

#### PostCSS Config (postcss.config.js)
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

## Deployment Workflows

### 1. Local to FileMaker Deployment

#### Using deploy-to-fm Script
```bash
# Build and deploy to FileMaker
npm run deploy-to-fm
```

This script:
1. Creates production build
2. Optimizes assets
3. Uploads to FileMaker server
4. Updates file references

#### Manual Deployment
1. Build project:
   ```bash
   npm run build
   ```
2. Copy contents of `dist` directory
3. Upload to FileMaker server
4. Update FileMaker web viewer references

### 2. CI/CD Pipeline

#### Build Stage
```yaml
build:
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
```

#### Test Stage
```yaml
test:
  script:
    - npm run test
    - npm run lint
```

#### Deploy Stage
```yaml
deploy:
  script:
    - npm run deploy-to-fm
  only:
    - main
```

## Deployment Environments

### Development
- Local development server
- Hot module replacement
- Source maps enabled
- Development tools available

### Staging
- Production-like environment
- Testing deployment process
- User acceptance testing
- Performance monitoring

### Production
- Optimized build
- Minified assets
- Error tracking
- Performance monitoring

## Version Management

### Version Control
```bash
# Create release branch
git checkout -b release/v1.0.0

# Update version
npm version 1.0.0

# Push changes
git push origin release/v1.0.0
```

### Release Process
1. Create release branch
2. Update version numbers
3. Run tests
4. Create production build
5. Deploy to staging
6. User acceptance testing
7. Deploy to production
8. Tag release

## Post-Deployment

### Verification
1. Check application loads
2. Verify FileMaker integration
3. Test critical features
4. Monitor error logs
5. Check performance metrics

### Monitoring
- Application performance
- Error rates
- API response times
- Resource usage
- User activity

### Rollback Procedure
1. Identify issues
2. Stop current deployment
3. Restore previous version
4. Verify functionality
5. Document incident

## Maintenance

### Regular Tasks
- Update dependencies
- Security patches
- Performance optimization
- Log rotation
- Backup verification

### Emergency Updates
1. Hotfix procedure
2. Quick deployment process
3. Verification steps
4. User communication

## Troubleshooting

### Common Issues

#### Build Failures
- Check Node.js version
- Verify dependencies
- Check build logs
- Validate configuration

#### Deployment Failures
- Check server connectivity
- Verify credentials
- Check file permissions
- Review error logs

#### Integration Issues
- Verify FileMaker connection
- Check API endpoints
- Validate data flow
- Test authentication

### Recovery Steps

#### Build Recovery
1. Clear cache
2. Remove node_modules
3. Fresh install
4. Rebuild project

#### Deployment Recovery
1. Stop deployment
2. Restore backup
3. Verify functionality
4. Document issues

## Security Considerations

### Production Security
- Environment variable protection
- Access control
- Data encryption
- Secure communication

### Deployment Security
- Secure file transfer
- Access logging
- Credential management
- Audit trail

## Documentation

### Deployment Documentation
- Update procedures
- Configuration details
- Environment setup
- Troubleshooting guides

### Change Log
- Version updates
- Feature additions
- Bug fixes
- Security patches

## Support

### Technical Support
- System administrators
- Development team
- FileMaker experts
- Security team

### User Support
- Documentation access
- Training materials
- Contact information
- Issue reporting