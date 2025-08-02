#!/usr/bin/env node

/**
 * Clarity Backend M2M Authentication Test Script
 * 
 * This script demonstrates and tests Machine-to-Machine (M2M) authentication
 * with the Clarity Backend API using HMAC-SHA256 signatures.
 * 
 * Usage:
 *   node scripts/m2m-auth-test.js
 *   
 * Environment Variables Required:
 *   VITE_SECRET_KEY - The shared secret key for HMAC-SHA256 signing
 * 
 * @author Clarity Business Solutions
 * @version 1.0.0
 */

const crypto = require('crypto')
require('dotenv').config()

/**
 * Clarity API Client with M2M Authentication
 * 
 * Implements HMAC-SHA256 based authentication for secure API access.
 * The authentication follows the pattern: Bearer {signature}.{timestamp}
 * where signature = HMAC-SHA256(secret, timestamp.payload)
 */
class ClarityAPIClient {
  /**
   * Initialize the API client
   * @param {string} secretKey - HMAC-SHA256 secret key
   * @param {string} baseUrl - Base URL for the API
   */
  constructor(secretKey, baseUrl = 'https://api.claritybusinesssolutions.ca') {
    this.secretKey = secretKey
    this.baseUrl = baseUrl
  }

  /**
   * Generate M2M authentication header
   * @param {string} payload - Request payload (empty string for GET requests)
   * @returns {string} Authorization header value
   */
  generateAuthHeader(payload = '') {
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `${timestamp}.${payload}`
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex')
    
    return `Bearer ${signature}.${timestamp}`
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint path
   * @param {string} method - HTTP method
   * @param {Object|null} data - Request data for POST/PUT requests
   * @returns {Promise<Object>} API response
   */
  async callAPI(endpoint, method = 'GET', data = null) {
    const payload = data ? JSON.stringify(data) : ''
    const authHeader = this.generateAuthHeader(payload)
    
    console.log(`🔐 Generated Auth Header: ${authHeader}`)
    console.log(`📡 Making request to: ${this.baseUrl}${endpoint}`)
    console.log(`🔧 Method: ${method}`)
    if (payload) console.log(`📦 Payload: ${payload}`)
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: payload || undefined
      })
      
      console.log(`📊 Response Status: ${response.status} ${response.statusText}`)
      
      const responseText = await response.text()
      let responseData
      
      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        responseData = responseText
      }
      
      console.log('📋 Response Data:', JSON.stringify(responseData, null, 2))
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        success: response.ok
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Test the health endpoint with both GET and POST methods
   * @returns {Promise<Object>} Test results
   */
  async testHealthEndpoint() {
    console.log('🚀 Starting Clarity Backend Health Check Test')
    console.log('=' .repeat(60))
    
    console.log('\n1️⃣  Testing GET /health (should work without auth)')
    console.log('-'.repeat(40))
    const getResult = await this.callAPI('/health', 'GET')
    
    console.log('\n2️⃣  Testing POST /health (requires auth)')
    console.log('-'.repeat(40))
    const postResult = await this.callAPI('/health', 'POST')
    
    console.log('\n📈 Test Results Summary:')
    console.log('=' .repeat(60))
    console.log(`GET /health: ${getResult.success ? '✅ SUCCESS' : '❌ FAILED'}`)
    console.log(`POST /health: ${postResult.success ? '✅ SUCCESS' : '❌ FAILED'}`)
    
    if (postResult.success) {
      console.log('🎉 M2M Authentication is working correctly!')
      console.log('🔑 Valid auth token generated and accepted by backend')
      
      if (postResult.data && postResult.data.authenticated) {
        console.log('\n🔍 Authentication Details:')
        console.log(`   Auth Type: ${postResult.data.auth_type}`)
        console.log(`   Timestamp: ${postResult.data.timestamp}`)
        console.log(`   Max Drift: ${postResult.data.secret_info?.max_timestamp_drift_seconds}s`)
      }
    } else {
      console.log('🔍 Authentication failed. Response details:')
      console.log(`   Status: ${postResult.status}`)
      console.log(`   Error: ${JSON.stringify(postResult.data)}`)
    }
    
    return {
      getHealth: getResult,
      postHealth: postResult,
      authWorking: postResult.success
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Validate environment
    const secretKey = process.env.VITE_SECRET_KEY
    if (!secretKey) {
      console.error('❌ Error: VITE_SECRET_KEY environment variable is required')
      console.log('💡 Make sure you have a .env file with VITE_SECRET_KEY set')
      process.exit(1)
    }
    
    console.log('✅ Using configured secret key from environment')
    
    // Initialize client and run tests
    const client = new ClarityAPIClient(secretKey)
    const results = await client.testHealthEndpoint()
    
    // Exit with appropriate code
    process.exit(results.authWorking ? 0 : 1)
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message)
    process.exit(1)
  }
}

// Export for potential reuse
module.exports = { ClarityAPIClient }

// Run if called directly
if (require.main === module) {
  main()
}