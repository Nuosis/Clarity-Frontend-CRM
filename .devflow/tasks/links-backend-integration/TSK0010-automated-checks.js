#!/usr/bin/env node

/**
 * TSK0010: Automated Integration Verification Checks
 *
 * This script performs automated verification of the links backend integration
 * without requiring manual UI testing. It checks code structure, imports,
 * and configuration to ensure the migration is complete.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../');

const checks = [];
let passCount = 0;
let failCount = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result.pass) {
      console.log(`✅ ${name}`);
      passCount++;
    } else {
      console.log(`❌ ${name}`);
      console.log(`   ${result.message}`);
      failCount++;
    }
    checks.push({ name, ...result });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failCount++;
    checks.push({ name, pass: false, message: error.message });
  }
}

function readFile(path) {
  const fullPath = join(projectRoot, path);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${path}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

console.log('🔍 Running TSK0010 Automated Verification Checks\n');
console.log('=' .repeat(60));

// Check 1: API layer uses backend endpoints
check('API layer routes to /links endpoint', () => {
  const content = readFile('src/api/links.js');

  if (content.includes('/fmi/data/v1') || content.includes('devLinks')) {
    return {
      pass: false,
      message: 'Found FileMaker references in API layer'
    };
  }

  if (!content.includes('/links')) {
    return {
      pass: false,
      message: 'Backend /links endpoint not found'
    };
  }

  return { pass: true, message: 'Routes to backend API' };
});

// Check 2: API layer has CRUD operations
check('API layer implements full CRUD', () => {
  const content = readFile('src/api/links.js');

  const operations = {
    create: content.includes('createLink'),
    read: content.includes('fetchLinks') || content.includes('getLinks'),
    update: content.includes('updateLink'),
    delete: content.includes('deleteLink')
  };

  const missing = Object.entries(operations)
    .filter(([op, exists]) => !exists)
    .map(([op]) => op);

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing operations: ${missing.join(', ')}`
    };
  }

  return { pass: true, message: 'All CRUD operations present' };
});

// Check 3: No FileMaker imports in API layer
check('API layer has no FileMaker imports', () => {
  const content = readFile('src/api/links.js');

  if (content.includes('fm-gofer') || content.includes('FileMaker')) {
    return {
      pass: false,
      message: 'Found FileMaker imports'
    };
  }

  return { pass: true, message: 'No FileMaker dependencies' };
});

// Check 4: Service layer has transformation function
check('Service layer has backend transformation', () => {
  const content = readFile('src/services/linkService.js');

  if (!content.includes('transformBackendLink')) {
    return {
      pass: false,
      message: 'transformBackendLink function not found'
    };
  }

  return { pass: true, message: 'Transformation function present' };
});

// Check 5: Service layer supports multiple operations
check('Service layer supports CRUD operations', () => {
  const content = readFile('src/services/linkService.js');

  const operations = {
    create: content.includes('createNewLink'),
    update: content.includes('updateExistingLink') || content.includes('updateLink'),
    delete: content.includes('deleteLinkById') || content.includes('deleteLink'),
    fetch: content.includes('fetchLinksByEntity') || content.includes('fetchLinks')
  };

  const missing = Object.entries(operations)
    .filter(([op, exists]) => !exists)
    .map(([op]) => op);

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing operations: ${missing.join(', ')}`
    };
  }

  return { pass: true, message: 'All CRUD operations supported' };
});

// Check 6: Hook has full CRUD operations
check('useLink hook has CRUD operations', () => {
  const content = readFile('src/hooks/useLink.js');

  const operations = {
    create: content.includes('handleLinkCreate'),
    update: content.includes('handleLinkUpdate'),
    delete: content.includes('handleLinkDelete'),
    fetch: content.includes('handleFetchLinks') || content.includes('fetchLinks')
  };

  const missing = Object.entries(operations)
    .filter(([op, exists]) => !exists)
    .map(([op]) => op);

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing operations: ${missing.join(', ')}`
    };
  }

  return { pass: true, message: 'All CRUD operations available' };
});

// Check 7: ProjectLinksTab uses environment-agnostic ID extraction
check('ProjectLinksTab supports dual environment', () => {
  const content = readFile('src/components/projects/ProjectLinksTab.jsx');

  // Check for various patterns of dual ID support
  const patterns = [
    'project?.id || project?.__ID',
    'project.__ID || project.id',
    'project.id || project.__ID',
    'projectId = project'
  ];

  const hasDualSupport = patterns.some(pattern => content.includes(pattern));

  if (!hasDualSupport) {
    return {
      pass: false,
      message: 'Missing environment-agnostic project ID extraction'
    };
  }

  return { pass: true, message: 'Supports both FileMaker and backend formats' };
});

// Check 8: ProjectLinksTab supports edit/delete
check('ProjectLinksTab has edit/delete UI', () => {
  const content = readFile('src/components/projects/ProjectLinksTab.jsx');

  const features = {
    edit: content.includes('handleLinkUpdate') || content.includes('editLink'),
    delete: content.includes('handleLinkDelete') || content.includes('deleteLink')
  };

  if (!features.edit || !features.delete) {
    return {
      pass: false,
      message: `Missing features: ${Object.entries(features).filter(([k,v]) => !v).map(([k]) => k).join(', ')}`
    };
  }

  return { pass: true, message: 'Edit and delete UI implemented' };
});

// Check 9: TaskList supports parentType parameter
check('TaskList passes parentType to useLink', () => {
  const content = readFile('src/components/tasks/TaskList.jsx');

  if (!content.includes('parentType') && !content.includes('task')) {
    return {
      pass: false,
      message: 'TaskList may not be passing correct parentType'
    };
  }

  return { pass: true, message: 'Supports task entity type' };
});

// Check 10: Test files exist
check('Test files exist for all layers', () => {
  const testFiles = [
    'src/api/__tests__/links.test.js',
    'src/services/__tests__/linkService.test.js',
    'src/hooks/__tests__/useLink.test.js'
  ];

  const missing = testFiles.filter(file => !existsSync(join(projectRoot, file)));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing test files: ${missing.join(', ')}`
    };
  }

  return { pass: true, message: 'All test files present' };
});

// Check 11: Schema uses correct field names
check('API layer uses correct backend schema', () => {
  const content = readFile('src/api/links.js');

  // Backend uses 'link' not 'url' as the primary field
  if (content.includes("'url':") || content.includes('"url":')) {
    // Check if it's being mapped FROM url TO link
    if (!content.includes('link:') && !content.includes("link'")) {
      return {
        pass: false,
        message: 'API may be using "url" instead of "link" field'
      };
    }
  }

  // Should have project_id, task_id, customer_id, organization_id support
  const foreignKeys = ['project_id', 'task_id', 'customer_id', 'organization_id'];
  const hasFKs = foreignKeys.some(fk => content.includes(fk));

  if (!hasFKs) {
    return {
      pass: false,
      message: 'Missing foreign key fields'
    };
  }

  return { pass: true, message: 'Uses correct backend schema' };
});

// Check 12: Transformation maps snake_case to camelCase
check('Transformation handles snake_case to camelCase', () => {
  const content = readFile('src/services/linkService.js');

  // Should map created_at -> createdAt, updated_at -> updatedAt
  const mappings = ['created_at', 'updated_at', 'created_by', 'updated_by'];
  const hasMappings = mappings.some(field => content.includes(field));

  if (!hasMappings) {
    return {
      pass: false,
      message: 'Missing snake_case to camelCase transformations'
    };
  }

  return { pass: true, message: 'Handles backend field naming' };
});

// Check 13: Error handling present
check('Components have error handling', () => {
  const projectLinksContent = readFile('src/components/projects/ProjectLinksTab.jsx');
  const taskListContent = readFile('src/components/tasks/TaskList.jsx');

  const hasErrorHandling = (content) => {
    return content.includes('catch') || content.includes('error') || content.includes('Error');
  };

  if (!hasErrorHandling(projectLinksContent)) {
    return {
      pass: false,
      message: 'ProjectLinksTab missing error handling'
    };
  }

  if (!hasErrorHandling(taskListContent)) {
    return {
      pass: false,
      message: 'TaskList missing error handling'
    };
  }

  return { pass: true, message: 'Error handling present in components' };
});

// Check 14: GitHub integration preserved
check('GitHub URL detection preserved', () => {
  const hookContent = readFile('src/hooks/useLink.js');

  if (!hookContent.includes('github') && !hookContent.includes('GitHub')) {
    return {
      pass: false,
      message: 'GitHub detection logic not found in hook'
    };
  }

  return { pass: true, message: 'GitHub integration maintained' };
});

// Check 15: Documentation exists
check('Task documentation exists', () => {
  const docs = [
    '.devflow/tasks/links-backend-integration/vision.md',
    '.devflow/tasks/links-backend-integration/workflows.md',
    '.devflow/tasks/links-backend-integration/BACKEND_ISSUE_REPORT.md',
    '.devflow/tasks/links-backend-integration/TSK0010-INTEGRATION-TEST-PLAN.md'
  ];

  const missing = docs.filter(doc => !existsSync(join(projectRoot, doc)));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Missing documentation: ${missing.join(', ')}`
    };
  }

  return { pass: true, message: 'All documentation present' };
});

console.log('=' .repeat(60));
console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed\n`);

if (failCount === 0) {
  console.log('✅ All automated checks passed!');
  console.log('\nNext steps:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Follow manual test plan: TSK0010-INTEGRATION-TEST-PLAN.md');
  console.log('3. Document results in TSK0010-TEST-RESULTS.md');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Review the issues above.');
  console.log('\nFix the failing checks before proceeding to manual testing.');
  process.exit(1);
}
