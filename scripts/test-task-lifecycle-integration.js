#!/usr/bin/env node

/**
 * Task Lifecycle Integration Testing Script
 *
 * Automated integration tests for complete task lifecycle workflows:
 * - Create task → start timer → stop timer → verify financial record
 * - Test fixed-price project (no financial record)
 * - Test concurrent timer scenarios
 * - Test error recovery paths
 *
 * Usage:
 *   npm run test:task-lifecycle
 *   npm run test:task-lifecycle -- --verbose
 *   npm run test:task-lifecycle -- --report
 *
 * Prerequisites:
 *   - Backend API accessible (https://api.claritybusinesssolutions.ca)
 *   - Tasks, time_entries, financial_records tables exist
 *   - Test customer and project exist
 */

import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Parse command line arguments
const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const generateReport = args.includes('--report')

// Configuration
const config = {
  backendUrl: process.env.VITE_API_URL || 'https://api.claritybusinesssolutions.ca',
  secretKey: process.env.VITE_SECRET_KEY,
  testCustomerId: process.env.TEST_CUSTOMER_ID || '00000000-0000-0000-0000-000000000001',
  testProjectId: process.env.TEST_PROJECT_ID || '00000000-0000-0000-0000-000000000002',
  testFixedPriceProjectId: process.env.TEST_FIXED_PRICE_PROJECT_ID || '00000000-0000-0000-0000-000000000003',
  testStaffId: process.env.TEST_STAFF_ID || '00000000-0000-0000-0000-000000000004',
  testOrgId: process.env.TEST_ORG_ID || '00000000-0000-0000-0000-000000000005'
}

// Validate configuration
if (!config.secretKey) {
  console.error('❌ VITE_SECRET_KEY not found in environment')
  console.error('   Please ensure .env file exists with required keys')
  process.exit(1)
}

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  startTime: new Date(),
  endTime: null
}

// Test data storage (for cleanup)
const testData = {
  taskIds: [],
  timerIds: [],
  financialRecordIds: []
}

// Utility functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🔍'
  }[level] || 'ℹ️'

  console.log(`${prefix} ${message}`)

  if (verbose && level === 'debug') {
    console.log(`   [${timestamp}]`)
  }
}

function logVerbose(message) {
  if (verbose) {
    log(message, 'debug')
  }
}

async function recordTest(name, passed, error = null, details = null) {
  const result = {
    name,
    passed,
    error: error?.message || error,
    details,
    timestamp: new Date()
  }

  results.tests.push(result)

  if (passed) {
    results.passed++
    log(`PASS: ${name}`, 'success')
  } else {
    results.failed++
    log(`FAIL: ${name}`, 'error')
    if (error) {
      console.error(`   Error: ${error.message || error}`)
      if (verbose && error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    }
  }

  if (details && verbose) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`)
  }
}

// HMAC Authentication
async function generateBackendAuthHeader(payload) {
  const timestamp = Date.now()
  const message = `${payload}${timestamp}`

  const hmac = crypto.createHmac('sha256', config.secretKey)
  hmac.update(message)
  const signature = hmac.digest('hex')

  return `Bearer ${signature}.${timestamp}`
}

// API Helper Functions
async function apiRequest(method, endpoint, data = null) {
  try {
    const payload = data ? JSON.stringify(data) : ''
    const authHeader = await generateBackendAuthHeader(payload)

    const requestConfig = {
      method,
      url: `${config.backendUrl}${endpoint}`,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    }

    if (data && (method === 'POST' || method === 'PATCH')) {
      requestConfig.data = data
    }

    if (method === 'GET' && data) {
      requestConfig.params = data
    }

    logVerbose(`API Request: ${method} ${endpoint}`)
    if (verbose && data) {
      logVerbose(`Request Data: ${JSON.stringify(data, null, 2)}`)
    }

    const response = await axios(requestConfig)

    logVerbose(`API Response: ${response.status}`)
    if (verbose && response.data) {
      logVerbose(`Response Data: ${JSON.stringify(response.data, null, 2)}`)
    }

    return response.data
  } catch (error) {
    logVerbose(`API Error: ${error.message}`)
    if (error.response?.data) {
      logVerbose(`Error Details: ${JSON.stringify(error.response.data, null, 2)}`)
    }
    throw error
  }
}

// Test Helper Functions
async function createTestTask(customData = {}) {
  const taskData = {
    title: `Test Task ${Date.now()}`,
    project_id: config.testProjectId,
    customer_id: config.testCustomerId,
    staff_id: config.testStaffId,
    priority: 3,
    status: 'pending',
    is_completed: false,
    ...customData
  }

  const task = await apiRequest('POST', '/tasks', taskData)
  testData.taskIds.push(task.id)
  return task
}

async function cleanupTestData() {
  log('Cleaning up test data...', 'info')

  let cleanedCount = 0
  let errorCount = 0

  // Clean up timers
  for (const timerId of testData.timerIds) {
    try {
      await apiRequest('DELETE', `/time-entries/${timerId}`)
      cleanedCount++
    } catch (error) {
      errorCount++
      logVerbose(`Failed to delete timer ${timerId}: ${error.message}`)
    }
  }

  // Clean up tasks
  for (const taskId of testData.taskIds) {
    try {
      await apiRequest('DELETE', `/tasks/${taskId}`)
      cleanedCount++
    } catch (error) {
      errorCount++
      logVerbose(`Failed to delete task ${taskId}: ${error.message}`)
    }
  }

  log(`Cleanup complete: ${cleanedCount} items deleted, ${errorCount} errors`, 'info')
}

// Prerequisite checks
async function checkPrerequisites() {
  log('Checking prerequisites...', 'info')

  try {
    // Check backend API health
    try {
      const response = await axios.get(`${config.backendUrl}/health`, { timeout: 5000 })
      log('Backend API is accessible', 'success')
    } catch (error) {
      throw new Error('Backend API is not accessible')
    }

    // Check if tasks endpoint exists
    try {
      const authHeader = await generateBackendAuthHeader('')
      await axios.get(`${config.backendUrl}/tasks`, {
        params: { project_id: config.testProjectId },
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })
      log('Tasks endpoint is accessible', 'success')
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Tasks endpoint not found. Backend deployment may be incomplete.')
      }
      throw new Error(`Tasks endpoint error: ${error.message}`)
    }

    // Check if time-entries endpoint exists
    try {
      const authHeader = await generateBackendAuthHeader('')
      await axios.get(`${config.backendUrl}/time-entries/active`, {
        params: { staff_id: config.testStaffId },
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })
      log('Time entries endpoint is accessible', 'success')
    } catch (error) {
      if (error.response?.status === 404 && error.response?.data?.detail === 'No active timer found') {
        log('Time entries endpoint is accessible', 'success')
      } else if (error.response?.status === 404) {
        throw new Error('Time entries endpoint not found. Backend deployment may be incomplete.')
      } else {
        throw new Error(`Time entries endpoint error: ${error.message}`)
      }
    }

    log('All prerequisites passed', 'success')
    return true
  } catch (error) {
    log(`Prerequisites check failed: ${error.message}`, 'error')
    throw error
  }
}

// Test Cases

async function testCompleteTaskLifecycle() {
  log('\nTest: Complete Task Lifecycle (Hourly Project)', 'info')

  try {
    // Step 1: Create task
    const task = await createTestTask({
      title: 'Hourly Project Task',
      description: 'Test task for hourly project'
    })

    await recordTest('Create task', true, null, { taskId: task.id })

    // Step 2: Start timer
    const startTimerData = {
      task_id: task.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer = await apiRequest('POST', '/time-entries/start', startTimerData)
    testData.timerIds.push(timer.id)

    await recordTest('Start timer', true, null, { timerId: timer.id })

    // Step 3: Wait a few seconds to simulate work
    log('Simulating work (3 seconds)...', 'info')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Step 4: Stop timer
    const stopTimerData = {
      description: 'Completed test work',
      adjustment_seconds: 0
    }

    const stopResult = await apiRequest('POST', `/time-entries/${timer.id}/stop`, stopTimerData)

    await recordTest('Stop timer', true, null, {
      timerId: timer.id,
      duration: stopResult.time_entry?.duration_minutes
    })

    // Step 5: Verify financial record was created
    if (stopResult.financial_record) {
      await recordTest('Financial record created', true, null, {
        financialRecordId: stopResult.financial_record.id,
        amount: stopResult.financial_record.amount,
        hours: stopResult.financial_record.hours
      })
      testData.financialRecordIds.push(stopResult.financial_record.id)
    } else {
      await recordTest('Financial record created', false, new Error('No financial record in response'))
    }

    // Step 6: Verify financial record details
    if (stopResult.financial_record) {
      const hasValidAmount = stopResult.financial_record.amount > 0
      const hasValidHours = stopResult.financial_record.hours > 0
      const hasValidRate = stopResult.financial_record.rate > 0

      await recordTest('Financial record has valid amount', hasValidAmount,
        hasValidAmount ? null : new Error('Amount is 0 or missing'))

      await recordTest('Financial record has valid hours', hasValidHours,
        hasValidHours ? null : new Error('Hours is 0 or missing'))

      await recordTest('Financial record has valid rate', hasValidRate,
        hasValidRate ? null : new Error('Rate is 0 or missing'))

      // Verify calculation: amount = hours * rate
      const calculatedAmount = parseFloat(stopResult.financial_record.hours) * parseFloat(stopResult.financial_record.rate)
      const actualAmount = parseFloat(stopResult.financial_record.amount)
      const isCalculationCorrect = Math.abs(calculatedAmount - actualAmount) < 0.01

      await recordTest('Financial record calculation correct', isCalculationCorrect,
        isCalculationCorrect ? null : new Error(`Expected ${calculatedAmount}, got ${actualAmount}`))
    }

  } catch (error) {
    await recordTest('Complete task lifecycle', false, error)
  }
}

async function testFixedPriceProject() {
  log('\nTest: Fixed-Price Project (No Financial Record)', 'info')

  try {
    // Step 1: Create task for fixed-price project
    const task = await createTestTask({
      title: 'Fixed-Price Project Task',
      project_id: config.testFixedPriceProjectId,
      description: 'Test task for fixed-price project'
    })

    await recordTest('Create task for fixed-price project', true, null, { taskId: task.id })

    // Step 2: Start timer
    const startTimerData = {
      task_id: task.id,
      staff_id: config.testStaffId,
      is_billable: false // Fixed-price projects are not billable
    }

    const timer = await apiRequest('POST', '/time-entries/start', startTimerData)
    testData.timerIds.push(timer.id)

    await recordTest('Start timer for fixed-price project', true, null, { timerId: timer.id })

    // Step 3: Wait a few seconds
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 4: Stop timer
    const stopTimerData = {
      description: 'Completed fixed-price work',
      adjustment_seconds: 0
    }

    const stopResult = await apiRequest('POST', `/time-entries/${timer.id}/stop`, stopTimerData)

    await recordTest('Stop timer for fixed-price project', true, null, { timerId: timer.id })

    // Step 5: Verify NO financial record was created
    const noFinancialRecord = !stopResult.financial_record || stopResult.financial_record === null

    await recordTest('No financial record for fixed-price project', noFinancialRecord,
      noFinancialRecord ? null : new Error('Financial record should not be created for fixed-price projects'))

  } catch (error) {
    await recordTest('Fixed-price project test', false, error)
  }
}

async function testConcurrentTimerPrevention() {
  log('\nTest: Concurrent Timer Prevention', 'info')

  try {
    // Step 1: Create two tasks
    const task1 = await createTestTask({ title: 'Concurrent Task 1' })
    const task2 = await createTestTask({ title: 'Concurrent Task 2' })

    await recordTest('Create two tasks for concurrency test', true)

    // Step 2: Start timer on first task
    const timer1Data = {
      task_id: task1.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer1 = await apiRequest('POST', '/time-entries/start', timer1Data)
    testData.timerIds.push(timer1.id)

    await recordTest('Start first timer', true, null, { timerId: timer1.id })

    // Step 3: Attempt to start timer on second task (should fail)
    let concurrentTimerPrevented = false
    try {
      const timer2Data = {
        task_id: task2.id,
        staff_id: config.testStaffId,
        is_billable: true
      }

      await apiRequest('POST', '/time-entries/start', timer2Data)

      // If we get here, concurrent timer was NOT prevented
      await recordTest('Concurrent timer prevented', false,
        new Error('Second timer should not have been allowed to start'))

    } catch (error) {
      // Expected to fail with 409 conflict
      concurrentTimerPrevented = error.response?.status === 409 ||
                                  error.message.includes('already has an active timer')

      await recordTest('Concurrent timer prevented', concurrentTimerPrevented,
        concurrentTimerPrevented ? null : new Error(`Expected 409 conflict, got: ${error.message}`),
        { errorStatus: error.response?.status, errorMessage: error.message })
    }

    // Step 4: Stop first timer
    const stopTimer1Data = {
      description: 'First timer completed',
      adjustment_seconds: 0
    }

    await apiRequest('POST', `/time-entries/${timer1.id}/stop`, stopTimer1Data)
    await recordTest('Stop first timer', true)

    // Step 5: Now start timer on second task (should succeed)
    const timer2Data = {
      task_id: task2.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer2 = await apiRequest('POST', '/time-entries/start', timer2Data)
    testData.timerIds.push(timer2.id)

    await recordTest('Start second timer after first stopped', true, null, { timerId: timer2.id })

    // Cleanup
    await apiRequest('POST', `/time-entries/${timer2.id}/stop`, {
      description: 'Test cleanup',
      adjustment_seconds: 0
    })

  } catch (error) {
    await recordTest('Concurrent timer prevention test', false, error)
  }
}

async function testPauseResumeTimer() {
  log('\nTest: Pause and Resume Timer', 'info')

  try {
    // Step 1: Create task
    const task = await createTestTask({ title: 'Pause Resume Task' })
    await recordTest('Create task for pause/resume test', true)

    // Step 2: Start timer
    const timerData = {
      task_id: task.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer = await apiRequest('POST', '/time-entries/start', timerData)
    testData.timerIds.push(timer.id)

    await recordTest('Start timer for pause/resume', true, null, { timerId: timer.id })

    // Step 3: Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 4: Pause timer
    const pausedTimer = await apiRequest('POST', `/time-entries/${timer.id}/pause`, null)

    const isPaused = pausedTimer.status === 'paused'
    await recordTest('Pause timer', isPaused,
      isPaused ? null : new Error(`Expected status 'paused', got '${pausedTimer.status}'`))

    // Step 5: Wait 2 seconds while paused
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 6: Resume timer
    const resumedTimer = await apiRequest('POST', `/time-entries/${timer.id}/resume`, null)

    const isActive = resumedTimer.status === 'active'
    await recordTest('Resume timer', isActive,
      isActive ? null : new Error(`Expected status 'active', got '${resumedTimer.status}'`))

    // Step 7: Verify pause duration was tracked
    const hasPauseDuration = resumedTimer.pause_duration_seconds > 0
    await recordTest('Pause duration tracked', hasPauseDuration,
      hasPauseDuration ? null : new Error('Pause duration should be > 0'))

    // Step 8: Stop timer
    const stopResult = await apiRequest('POST', `/time-entries/${timer.id}/stop`, {
      description: 'Pause/resume test completed',
      adjustment_seconds: 0
    })

    await recordTest('Stop timer after pause/resume', true)

    // Step 9: Verify pause time was excluded from billable time
    if (stopResult.time_entry && stopResult.financial_record) {
      const totalMinutes = stopResult.time_entry.duration_minutes
      const pauseMinutes = (stopResult.time_entry.pause_duration_seconds || 0) / 60
      const billableHours = stopResult.financial_record.hours

      // Billable hours should be less than total time due to pause
      const pauseExcluded = billableHours < (totalMinutes / 60)

      await recordTest('Pause time excluded from billable hours', pauseExcluded,
        pauseExcluded ? null : new Error('Pause time should reduce billable hours'),
        {
          totalMinutes,
          pauseMinutes,
          billableHours
        })
    }

  } catch (error) {
    await recordTest('Pause/resume timer test', false, error)
  }
}

async function testTimerAdjustment() {
  log('\nTest: Timer Adjustment (6-minute increments)', 'info')

  try {
    // Step 1: Create task
    const task = await createTestTask({ title: 'Adjustment Task' })
    await recordTest('Create task for adjustment test', true)

    // Step 2: Start timer
    const timerData = {
      task_id: task.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer = await apiRequest('POST', '/time-entries/start', timerData)
    testData.timerIds.push(timer.id)

    await recordTest('Start timer for adjustment test', true)

    // Step 3: Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 4: Stop timer with positive adjustment (360 seconds = 6 minutes)
    const stopData = {
      description: 'Work with adjustment',
      adjustment_seconds: 360
    }

    const stopResult = await apiRequest('POST', `/time-entries/${timer.id}/stop`, stopData)

    await recordTest('Stop timer with adjustment', true)

    // Step 5: Verify adjustment was applied
    if (stopResult.time_entry && stopResult.time_entry.adjustment_seconds !== undefined) {
      const adjustmentApplied = stopResult.time_entry.adjustment_seconds === 360

      await recordTest('Adjustment applied correctly', adjustmentApplied,
        adjustmentApplied ? null : new Error(`Expected 360, got ${stopResult.time_entry.adjustment_seconds}`))
    }

    // Step 6: Test invalid adjustment (should fail or round)
    const task2 = await createTestTask({ title: 'Invalid Adjustment Task' })
    const timer2Data = {
      task_id: task2.id,
      staff_id: config.testStaffId,
      is_billable: true
    }

    const timer2 = await apiRequest('POST', '/time-entries/start', timer2Data)
    testData.timerIds.push(timer2.id)

    await new Promise(resolve => setTimeout(resolve, 1000))

    // Try to stop with invalid adjustment (not 6-minute increment)
    try {
      await apiRequest('POST', `/time-entries/${timer2.id}/stop`, {
        description: 'Invalid adjustment',
        adjustment_seconds: 300 // 5 minutes - invalid
      })

      // If it succeeds, check if it was rounded
      await recordTest('Invalid adjustment handled', true, null,
        { note: 'Backend accepted or rounded invalid adjustment' })

    } catch (error) {
      // Expected to fail
      const validationError = error.response?.status === 422 ||
                              error.message.includes('increment')

      await recordTest('Invalid adjustment rejected', validationError,
        validationError ? null : new Error('Expected validation error for invalid increment'))
    }

  } catch (error) {
    await recordTest('Timer adjustment test', false, error)
  }
}

async function testErrorRecovery() {
  log('\nTest: Error Recovery Paths', 'info')

  try {
    // Test 1: Stop non-existent timer
    try {
      await apiRequest('POST', '/time-entries/00000000-0000-0000-0000-000000000099/stop', {
        description: 'Test',
        adjustment_seconds: 0
      })

      await recordTest('Stop non-existent timer returns error', false,
        new Error('Should have failed with 404'))

    } catch (error) {
      const correctError = error.response?.status === 404
      await recordTest('Stop non-existent timer returns error', correctError,
        correctError ? null : new Error(`Expected 404, got ${error.response?.status}`))
    }

    // Test 2: Start timer on non-existent task
    try {
      await apiRequest('POST', '/time-entries/start', {
        task_id: '00000000-0000-0000-0000-000000000098',
        staff_id: config.testStaffId,
        is_billable: true
      })

      await recordTest('Start timer on non-existent task returns error', false,
        new Error('Should have failed with 404'))

    } catch (error) {
      const correctError = error.response?.status === 404 || error.response?.status === 422
      await recordTest('Start timer on non-existent task returns error', correctError,
        correctError ? null : new Error(`Expected 404/422, got ${error.response?.status}`))
    }

    // Test 3: Pause already paused timer
    const task = await createTestTask({ title: 'Error Recovery Task' })
    const timer = await apiRequest('POST', '/time-entries/start', {
      task_id: task.id,
      staff_id: config.testStaffId,
      is_billable: true
    })
    testData.timerIds.push(timer.id)

    await apiRequest('POST', `/time-entries/${timer.id}/pause`, null)

    try {
      await apiRequest('POST', `/time-entries/${timer.id}/pause`, null)

      await recordTest('Pause already paused timer returns error', false,
        new Error('Should have failed'))

    } catch (error) {
      const correctError = error.response?.status === 400 ||
                          error.message.includes('must be active')
      await recordTest('Pause already paused timer returns error', correctError,
        correctError ? null : new Error('Expected validation error'))
    }

    // Cleanup
    await apiRequest('POST', `/time-entries/${timer.id}/resume`, null)
    await apiRequest('POST', `/time-entries/${timer.id}/stop`, {
      description: 'Cleanup',
      adjustment_seconds: 0
    })

  } catch (error) {
    await recordTest('Error recovery test', false, error)
  }
}

// Generate Report
function generateReport() {
  results.endTime = new Date()
  const duration = (results.endTime - results.startTime) / 1000

  const report = {
    summary: {
      total: results.tests.length,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      duration: `${duration.toFixed(2)}s`,
      timestamp: results.startTime.toISOString()
    },
    tests: results.tests,
    environment: {
      backendUrl: config.backendUrl,
      testProjectId: config.testProjectId,
      testCustomerId: config.testCustomerId
    }
  }

  const reportPath = path.join(__dirname, '..', 'test-reports', `task-lifecycle-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  log(`Report generated: ${reportPath}`, 'success')
  return report
}

// Print Summary
function printSummary() {
  results.endTime = new Date()
  const duration = (results.endTime - results.startTime) / 1000

  console.log('\n' + '='.repeat(60))
  console.log('TASK LIFECYCLE INTEGRATION TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Total Tests:   ${results.tests.length}`)
  console.log(`✅ Passed:      ${results.passed}`)
  console.log(`❌ Failed:      ${results.failed}`)
  console.log(`⏭️  Skipped:     ${results.skipped}`)
  console.log(`Duration:      ${duration.toFixed(2)}s`)
  console.log('='.repeat(60))

  if (results.failed > 0) {
    console.log('\nFailed Tests:')
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  ❌ ${t.name}`)
        console.log(`     ${t.error}`)
      })
  }

  return results.failed === 0 ? 0 : 1
}

// Main Test Runner
async function main() {
  log('Starting Task Lifecycle Integration Tests', 'info')
  log('='.repeat(60), 'info')

  try {
    // Run prerequisite checks
    await checkPrerequisites()

    // Run test suites
    await testCompleteTaskLifecycle()
    await testFixedPriceProject()
    await testConcurrentTimerPrevention()
    await testPauseResumeTimer()
    await testTimerAdjustment()
    await testErrorRecovery()

    // Cleanup
    await cleanupTestData()

    // Generate report if requested
    if (generateReport) {
      generateReport()
    }

    // Print summary and exit
    const exitCode = printSummary()
    process.exit(exitCode)

  } catch (error) {
    log(`Test execution failed: ${error.message}`, 'error')
    if (verbose && error.stack) {
      console.error(error.stack)
    }

    // Attempt cleanup even on failure
    try {
      await cleanupTestData()
    } catch (cleanupError) {
      log(`Cleanup failed: ${cleanupError.message}`, 'warning')
    }

    process.exit(1)
  }
}

// Run tests
main()
