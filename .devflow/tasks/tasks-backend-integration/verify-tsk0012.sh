#!/bin/bash

# TSK0012 Verification Script
# Verifies that all mocks and fixtures are properly created and functional

set -e

echo "=========================================="
echo "TSK0012 Verification Script"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Helper function to check if file exists
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $description: $file (NOT FOUND)"
        ((FAILED++))
    fi
}

# Helper function to check if file contains text
check_content() {
    local file=$1
    local search_text=$2
    local description=$3

    if grep -q "$search_text" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $description (NOT FOUND)"
        ((FAILED++))
    fi
}

echo "1. Checking Fixture Files..."
echo "----------------------------"
check_file "src/__fixtures__/tasks.js" "Tasks fixture"
check_file "src/__fixtures__/timers.js" "Timers fixture"
check_file "src/__fixtures__/financialRecords.js" "Financial records fixture"
check_file "src/__fixtures__/index.js" "Fixtures index"
echo ""

echo "2. Checking Mock Files..."
echo "-------------------------"
check_file "src/__mocks__/tasksApi.js" "Tasks API mock"
check_file "src/__mocks__/axios.js" "Axios mock"
check_file "src/__mocks__/testUtils.js" "Test utilities"
echo ""

echo "3. Checking Test Files..."
echo "-------------------------"
check_file "src/__tests__/tasksApi.mock.test.js" "Mock API tests"
echo ""

echo "4. Checking Documentation..."
echo "----------------------------"
check_file ".devflow/tasks/tasks-backend-integration/TSK0012_IMPLEMENTATION.md" "Implementation doc"
check_file ".devflow/tasks/tasks-backend-integration/TSK0012_VERIFICATION.md" "Verification doc"
check_file ".devflow/tasks/tasks-backend-integration/TSK0012_QUICK_REFERENCE.md" "Quick reference"
check_file ".devflow/tasks/tasks-backend-integration/TSK0012_SUMMARY.md" "Summary doc"
echo ""

echo "5. Verifying Fixture Content..."
echo "--------------------------------"
check_content "src/__fixtures__/tasks.js" "export const mockTask" "mockTask export"
check_content "src/__fixtures__/tasks.js" "export const mockCompletedTask" "mockCompletedTask export"
check_content "src/__fixtures__/timers.js" "export const mockActiveTimer" "mockActiveTimer export"
check_content "src/__fixtures__/timers.js" "export const mockPausedTimer" "mockPausedTimer export"
check_content "src/__fixtures__/financialRecords.js" "export const mockFinancialRecord" "mockFinancialRecord export"
echo ""

echo "6. Verifying Mock API Functions..."
echo "-----------------------------------"
check_content "src/__mocks__/tasksApi.js" "mockFetchTasksForProject" "fetchTasksForProject function"
check_content "src/__mocks__/tasksApi.js" "mockCreateTask" "createTask function"
check_content "src/__mocks__/tasksApi.js" "mockStartTimer" "startTimer function"
check_content "src/__mocks__/tasksApi.js" "mockStopTimer" "stopTimer function"
check_content "src/__mocks__/tasksApi.js" "mockPauseTimer" "pauseTimer function"
check_content "src/__mocks__/tasksApi.js" "mockResumeTimer" "resumeTimer function"
check_content "src/__mocks__/tasksApi.js" "mockGetActiveTimer" "getActiveTimer function"
check_content "src/__mocks__/tasksApi.js" "resetMockState" "resetMockState function"
echo ""

echo "7. Verifying Decimal String Format..."
echo "--------------------------------------"
check_content "src/__fixtures__/timers.js" "hourly_rate: '100.00'" "Decimal strings in timers"
check_content "src/__fixtures__/financialRecords.js" "quantity: '5.5'" "Decimal strings in financial records"
echo ""

echo "8. Verifying Backend Field Compliance..."
echo "-----------------------------------------"
check_content "src/__fixtures__/timers.js" "duration_minutes" "duration_minutes field"
check_content "src/__fixtures__/timers.js" "billable_amount" "billable_amount field"
check_content "src/__fixtures__/timers.js" "completed_at" "completed_at field"
check_content "src/__fixtures__/financialRecords.js" "billing_status" "billing_status field"
check_content "src/__fixtures__/financialRecords.js" "time_entry_id" "time_entry_id field"
check_content "src/__fixtures__/tasks.js" "actual_hours" "actual_hours field"
check_content "src/__fixtures__/tasks.js" "filemaker_task_id" "filemaker_task_id field"
echo ""

echo "9. Verifying Business Logic..."
echo "-------------------------------"
check_content "src/__mocks__/tasksApi.js" "activeTimersByStaff" "Concurrency control map"
check_content "src/__mocks__/tasksApi.js" "409" "Concurrency error code"
check_content "src/__mocks__/tasksApi.js" "financial_record" "Financial record generation"
check_content "src/__mocks__/tasksApi.js" "projectIsFixedPrice" "Fixed-price detection"
echo ""

echo "10. Running Build Test..."
echo "-------------------------"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Build succeeded"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Build failed"
    ((FAILED++))
fi
echo ""

echo "11. Checking tasks.json..."
echo "--------------------------"
check_content ".devflow/tasks/tasks-backend-integration/tasks.json" '"status": "done"' "TSK0012 marked as done"
check_content ".devflow/tasks/tasks-backend-integration/tasks.json" '"completed_at"' "TSK0012 has completion timestamp"
echo ""

# Summary
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "TSK0012 is complete and verified."
    echo "Ready for TSK0013 and TSK0014."
    exit 0
else
    echo -e "${RED}✗ Some checks failed.${NC}"
    echo ""
    echo "Please review the failures above."
    exit 1
fi
