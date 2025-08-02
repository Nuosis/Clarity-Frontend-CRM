#!/bin/bash

# Clarity Backend M2M Authentication Test Script
# 
# This script demonstrates and tests Machine-to-Machine (M2M) authentication
# with the Clarity Backend API using HMAC-SHA256 signatures.
# 
# Usage:
#   ./scripts/m2m-auth-test.sh
#   
# Environment Variables Required:
#   VITE_SECRET_KEY - The shared secret key for HMAC-SHA256 signing
# 
# @author Clarity Business Solutions
# @version 1.0.0

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="https://api.claritybusinesssolutions.ca"
HEALTH_ENDPOINT="/health"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if secret key is available
if [ -z "$VITE_SECRET_KEY" ]; then
    echo -e "${RED}❌ Error: VITE_SECRET_KEY environment variable is required${NC}"
    echo -e "${YELLOW}💡 Make sure you have a .env file with VITE_SECRET_KEY set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Using configured secret key from environment${NC}"

# Function to generate HMAC-SHA256 signature
generate_auth_header() {
    local payload="$1"
    local timestamp=$(date +%s)
    local message="${timestamp}.${payload}"
    
    # Generate HMAC-SHA256 signature
    local signature=$(echo -n "$message" | openssl dgst -sha256 -hmac "$VITE_SECRET_KEY" | cut -d' ' -f2)
    
    echo "Bearer ${signature}.${timestamp}"
}

# Function to make API request
make_api_request() {
    local method="$1"
    local endpoint="$2"
    local payload="$3"
    local auth_header="$4"
    
    echo -e "${CYAN}🔐 Generated Auth Header: ${auth_header}${NC}"
    echo -e "${CYAN}📡 Making request to: ${API_BASE_URL}${endpoint}${NC}"
    echo -e "${CYAN}🔧 Method: ${method}${NC}"
    
    if [ -n "$payload" ]; then
        echo -e "${CYAN}📦 Payload: ${payload}${NC}"
    fi
    
    # Make the request and capture response
    local response
    local http_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X GET \
            -H "Authorization: $auth_header" \
            -H "Content-Type: application/json" \
            "${API_BASE_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Authorization: $auth_header" \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "${API_BASE_URL}${endpoint}")
    fi
    
    # Extract HTTP code and response body
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    echo -e "${CYAN}📊 Response Status: ${http_code}${NC}"
    echo -e "${CYAN}📋 Response Data:${NC}"
    echo "$response_body" | jq . 2>/dev/null || echo "$response_body"
    
    # Return success/failure
    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Main test function
run_health_tests() {
    echo -e "${BLUE}🚀 Starting Clarity Backend Health Check Test${NC}"
    echo -e "${BLUE}============================================================${NC}"
    
    local get_success=false
    local post_success=false
    
    # Test 1: GET /health (should work without auth)
    echo -e "\n${YELLOW}1️⃣  Testing GET /health (should work without auth)${NC}"
    echo -e "${YELLOW}----------------------------------------${NC}"
    
    local auth_header=$(generate_auth_header "")
    if make_api_request "GET" "$HEALTH_ENDPOINT" "" "$auth_header"; then
        get_success=true
    fi
    
    # Test 2: POST /health (requires auth)
    echo -e "\n${YELLOW}2️⃣  Testing POST /health (requires auth)${NC}"
    echo -e "${YELLOW}----------------------------------------${NC}"
    
    local auth_header=$(generate_auth_header "")
    if make_api_request "POST" "$HEALTH_ENDPOINT" "" "$auth_header"; then
        post_success=true
    fi
    
    # Results summary
    echo -e "\n${BLUE}📈 Test Results Summary:${NC}"
    echo -e "${BLUE}============================================================${NC}"
    
    if [ "$get_success" = true ]; then
        echo -e "GET /health: ${GREEN}✅ SUCCESS${NC}"
    else
        echo -e "GET /health: ${RED}❌ FAILED${NC}"
    fi
    
    if [ "$post_success" = true ]; then
        echo -e "POST /health: ${GREEN}✅ SUCCESS${NC}"
        echo -e "${GREEN}🎉 M2M Authentication is working correctly!${NC}"
        echo -e "${GREEN}🔑 Valid auth token generated and accepted by backend${NC}"
    else
        echo -e "POST /health: ${RED}❌ FAILED${NC}"
        echo -e "${RED}🔍 Authentication failed. Check the response details above.${NC}"
    fi
    
    # Exit with appropriate code
    if [ "$post_success" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v openssl &> /dev/null; then
        missing_deps+=("openssl")
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: jq not found. JSON output will not be formatted.${NC}"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}❌ Error: Missing required dependencies: ${missing_deps[*]}${NC}"
        echo -e "${YELLOW}💡 Please install the missing dependencies and try again.${NC}"
        exit 1
    fi
}

# Main execution
main() {
    check_dependencies
    run_health_tests
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi