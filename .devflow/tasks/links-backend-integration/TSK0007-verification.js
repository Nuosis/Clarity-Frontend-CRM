#!/usr/bin/env node
/**
 * TSK0007 Verification Script
 * Verifies task link display and creation updates
 */

import fs from 'fs';

console.log('TSK0007 Verification - Task Link Display and Creation\n');
console.log('=' .repeat(60));

const checks = [];

// 1. Verify useLink hook supports parentType parameter
console.log('\n1. Checking useLink hook handleLinkCreate signature...');
const useLinkPath = './src/hooks/useLink.js';
const useLinkContent = fs.readFileSync(useLinkPath, 'utf8');

const hasParentTypeParam = useLinkContent.includes('handleLinkCreate = useCallback(async (fkId, linkUrl, parentType = \'project\')');
const passesParentType = useLinkContent.includes('await createNewLink(fkId, trimmedUrl, parentType)');
checks.push({
    name: 'useLink handleLinkCreate accepts parentType parameter',
    passed: hasParentTypeParam && passesParentType,
    details: hasParentTypeParam && passesParentType
        ? '✓ Hook accepts and passes parentType to createNewLink'
        : '✗ Hook missing parentType parameter support'
});

// 2. Verify TaskList passes 'task' parent type
console.log('2. Checking TaskList passes "task" parent type...');
const taskListPath = './src/components/tasks/TaskList.jsx';
const taskListContent = fs.readFileSync(taskListPath, 'utf8');

const passesTaskType = taskListContent.includes('await handleLinkCreate(taskId, url, \'task\')');
checks.push({
    name: 'TaskList passes "task" as parentType',
    passed: passesTaskType,
    details: passesTaskType
        ? '✓ TaskList correctly specifies task parent type'
        : '✗ TaskList missing task parent type specification'
});

// 3. Verify link display supports both url and link fields
console.log('3. Checking link display supports both formats...');
const supportsBothFormats = taskListContent.includes('const linkUrl = link.url || link.link');
const hasTitle = taskListContent.includes('const displayText = link.title || linkUrl');
checks.push({
    name: 'Link display supports both url and link fields',
    passed: supportsBothFormats && hasTitle,
    details: supportsBothFormats && hasTitle
        ? '✓ Displays links using url || link with title fallback'
        : '✗ Missing dual format support or title fallback'
});

// 4. Verify error handling updated
console.log('4. Checking error handling for task links...');
const hasTaskErrorHandling = taskListContent.includes('Error creating link for task');
checks.push({
    name: 'Error messages specific to task links',
    passed: hasTaskErrorHandling,
    details: hasTaskErrorHandling
        ? '✓ Error messages properly reference tasks'
        : '✗ Missing task-specific error messages'
});

// 5. Verify useLink hook uses transformed data from linkService
console.log('5. Checking useLink uses transformed backend response...');
const usesTransformedData = useLinkContent.includes('result.url || trimmedUrl') &&
                           useLinkContent.includes('result.title ||') &&
                           useLinkContent.includes('result.createdAt ||');
checks.push({
    name: 'useLink hook handles transformed backend response',
    passed: usesTransformedData,
    details: usesTransformedData
        ? '✓ Hook uses transformed fields (url, title, createdAt)'
        : '✗ Hook missing transformed field support'
});

// 6. Verify linkService transformation is preserved
console.log('6. Checking linkService transformation...');
const linkServicePath = './src/services/linkService.js';
const linkServiceContent = fs.readFileSync(linkServicePath, 'utf8');

const hasTransform = linkServiceContent.includes('export function transformBackendLink');
const transformsUrl = linkServiceContent.includes('url: linkUrl');
checks.push({
    name: 'linkService transforms backend to frontend format',
    passed: hasTransform && transformsUrl,
    details: hasTransform && transformsUrl
        ? '✓ Service transforms link → url correctly'
        : '✗ Missing or incomplete transformation'
});

// Print results
console.log('\n' + '='.repeat(60));
console.log('VERIFICATION RESULTS');
console.log('='.repeat(60) + '\n');

const passedCount = checks.filter(c => c.passed).length;
const totalCount = checks.length;

checks.forEach((check, idx) => {
    const status = check.passed ? '✓ PASS' : '✗ FAIL';
    const icon = check.passed ? '✓' : '✗';
    console.log(`${idx + 1}. [${status}] ${check.name}`);
    console.log(`   ${check.details}\n`);
});

console.log('='.repeat(60));
console.log(`Summary: ${passedCount}/${totalCount} checks passed`);
console.log('='.repeat(60));

// Exit with appropriate code
process.exit(passedCount === totalCount ? 0 : 1);
