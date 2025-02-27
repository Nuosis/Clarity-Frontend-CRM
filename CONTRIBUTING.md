# Contributing to ClarityFrontend CRM

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone [your-fork-url]
   cd clarityCrmFrontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env` file with required configuration
5. Start development server:
   ```bash
   npm run dev
   ```

## Development Guidelines

### Code Style

#### JavaScript/React
- Use functional components with hooks
- Follow React best practices
- Implement proper error boundaries
- Use PropTypes for component props
- Keep components focused and single-responsibility
- Use meaningful variable and function names
- Add JSDoc comments for functions

#### ESLint Configuration
We use ESLint to maintain code quality. Configuration is in `.eslintrc.json`:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended"
  ],
  "rules": {
    // Project-specific rules
  }
}
```

#### Prettier Configuration
Code formatting is handled by Prettier. Configuration in `.prettierrc.json`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Component Structure

#### File Organization
```
src/
├── components/
│   ├── layout/       # Layout components
│   ├── customers/    # Customer-related components
│   ├── projects/     # Project components
│   ├── tasks/        # Task components
│   └── global/       # Shared components
├── services/         # Business logic
├── api/             # API integration
├── hooks/           # Custom hooks
└── context/         # React context
```

#### Component Template
```jsx
import React from 'react';
import PropTypes from 'prop-types';

function ComponentName({ prop1, prop2 }) {
  // State and hooks
  
  // Event handlers
  
  // Render
  return (
    <div>
      {/* Component content */}
    </div>
  );
}

ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number
};

export default React.memo(ComponentName);
```

### State Management

#### Custom Hooks
- Create hooks for reusable logic
- Follow the `use` prefix convention
- Handle loading and error states
- Implement cleanup when needed

#### Context Usage
- Use context for global state
- Keep context providers focused
- Consider performance implications
- Document context shape

### Error Handling

#### Error Boundaries
- Implement error boundaries for component trees
- Log errors appropriately
- Provide user-friendly fallbacks
- Handle API errors gracefully

#### Error Formatting
```javascript
throw {
  error: true,
  message: 'User-friendly message',
  code: 'ERROR_CODE',
  details: {} // Additional information
};
```

## Git Workflow

### Branching Strategy

1. Main Branches
   - `main`: Production-ready code
   - `develop`: Integration branch

2. Supporting Branches
   - Feature: `feature/[feature-name]`
   - Bug fix: `fix/[bug-description]`
   - Release: `release/[version]`
   - Hotfix: `hotfix/[description]`

### Commit Guidelines

#### Format
```
type(scope): description

[optional body]
[optional footer]
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

#### Examples
```
feat(timer): add task timer adjustment controls
fix(api): resolve customer loading state issue
docs(readme): update installation instructions
```

### Pull Request Process

1. Create Feature Branch
   ```bash
   git checkout -b feature/your-feature
   ```

2. Development
   - Write code following style guidelines
   - Add tests where appropriate
   - Update documentation
   - Keep commits focused

3. Before Submission
   - Run tests: `npm test`
   - Run linter: `npm run lint`
   - Update CHANGELOG.md
   - Rebase if needed

4. Pull Request
   - Use PR template
   - Reference related issues
   - Provide clear description
   - Add screenshots if UI changes

5. Review Process
   - Address review comments
   - Keep PR focused
   - Update based on feedback
   - Maintain clean commit history

## Testing Guidelines

### Unit Tests
```javascript
describe('ComponentName', () => {
  it('should render correctly', () => {
    // Test implementation
  });
  
  it('should handle events', () => {
    // Test implementation
  });
});
```

### Integration Tests
- Test FileMaker integration
- Verify data flow
- Test error scenarios
- Check component interactions

### Test Coverage
- Maintain high coverage
- Focus on critical paths
- Test edge cases
- Mock external dependencies

## Documentation

### Code Documentation
- Use JSDoc comments
- Document complex logic
- Explain non-obvious decisions
- Keep comments up-to-date

### Component Documentation
```javascript
/**
 * Component description
 * @component
 * @param {string} prop1 - Description of prop1
 * @param {number} prop2 - Description of prop2
 * @returns {React.Element}
 */
```

### API Documentation
- Document endpoints
- Provide examples
- List parameters
- Describe responses

## Release Process

1. Version Update
   ```bash
   npm version [major|minor|patch]
   ```

2. Update CHANGELOG.md
   - Add version section
   - List changes
   - Credit contributors

3. Create Release Branch
   ```bash
   git checkout -b release/v1.0.0
   ```

4. Testing
   - Run full test suite
   - Verify in staging
   - Check documentation

5. Deployment
   - Merge to main
   - Tag release
   - Deploy to production

## Support

- Check documentation first
- Search existing issues
- Create detailed bug reports
- Join development discussions

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.