/**
 * Proposal Security Service
 * Handles token generation, validation, and security for proposals
 * Following DEVELOPMENT_GUIDELINES.md security patterns
 */
export class ProposalSecurityService {
  /**
   * Generate cryptographically secure token for proposal access
   * @param {string} proposalId - Proposal ID
   * @returns {string} Secure access token
   */
  static generateSecureToken(proposalId) {
    // Generate UUID v4 + additional entropy for maximum security
    const uuid = crypto.randomUUID()
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.getRandomValues(new Uint8Array(8))
    const entropy = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('')
    
    return `${uuid}-${timestamp}-${entropy}`
  }
  
  /**
   * Validate proposal access token
   * @param {string} token - Access token to validate
   * @returns {Object} Validation result
   */
  static validateToken(token) {
    try {
      // Basic format validation
      if (!token || typeof token !== 'string') {
        return {
          valid: false,
          error: 'Invalid token format'
        }
      }
      
      // Check token structure (UUID-timestamp-entropy)
      const parts = token.split('-')
      if (parts.length < 6) { // UUID has 5 parts, plus timestamp and entropy
        return {
          valid: false,
          error: 'Invalid token structure'
        }
      }
      
      // Extract timestamp and validate age
      const timestampPart = parts[5] // After UUID parts
      const timestamp = parseInt(timestampPart, 36)
      
      if (isNaN(timestamp)) {
        return {
          valid: false,
          error: 'Invalid token timestamp'
        }
      }
      
      // Check if token is too old (basic client-side check)
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
      const age = Date.now() - timestamp
      
      if (age > maxAge) {
        return {
          valid: false,
          error: 'Token has expired'
        }
      }
      
      return {
        valid: true,
        timestamp,
        age
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Token validation failed'
      }
    }
  }
  
  /**
   * Generate secure hash for proposal data integrity
   * @param {Object} proposalData - Proposal data to hash
   * @returns {Promise<string>} SHA-256 hash
   */
  static async generateDataHash(proposalData) {
    try {
      const dataString = JSON.stringify(proposalData, Object.keys(proposalData).sort())
      const encoder = new TextEncoder()
      const data = encoder.encode(dataString)
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      return hashHex
    } catch (error) {
      console.error('[ProposalSecurityService] Hash generation failed:', error)
      throw new Error('Failed to generate data hash')
    }
  }
  
  /**
   * Verify proposal data integrity
   * @param {Object} proposalData - Proposal data to verify
   * @param {string} expectedHash - Expected hash value
   * @returns {Promise<boolean>} True if data is valid
   */
  static async verifyDataIntegrity(proposalData, expectedHash) {
    try {
      const actualHash = await this.generateDataHash(proposalData)
      return actualHash === expectedHash
    } catch (error) {
      console.error('[ProposalSecurityService] Data verification failed:', error)
      return false
    }
  }
  
  /**
   * Create access log entry for security tracking
   * @param {string} proposalId - Proposal ID
   * @param {string} token - Access token used
   * @param {Object} accessInfo - Access information
   * @returns {Object} Log entry data
   */
  static createAccessLog(proposalId, token, accessInfo = {}) {
    return {
      proposal_id: proposalId,
      access_token: token,
      ip_address: accessInfo.ipAddress || null,
      user_agent: accessInfo.userAgent || navigator.userAgent,
      accessed_at: new Date().toISOString(),
      session_id: this.generateSessionId(),
      referrer: accessInfo.referrer || document.referrer || null
    }
  }
  
  /**
   * Generate session ID for tracking
   * @returns {string} Session ID
   */
  static generateSessionId() {
    return crypto.randomUUID()
  }
  
  /**
   * Sanitize proposal data for client display
   * Removes sensitive fields that shouldn't be exposed to clients
   * @param {Object} proposal - Raw proposal data
   * @returns {Object} Sanitized proposal data
   */
  static sanitizeProposalForClient(proposal) {
    if (!proposal) return null
    
    // Remove sensitive fields
    const {
      access_token, // Don't expose token in response
      created_at,
      updated_at,
      ...sanitizedProposal
    } = proposal
    
    // Sanitize deliverables (remove internal fields)
    if (sanitizedProposal.deliverables) {
      sanitizedProposal.deliverables = sanitizedProposal.deliverables.map(deliverable => {
        const {
          created_at: deliverableCreatedAt,
          ...sanitizedDeliverable
        } = deliverable
        return sanitizedDeliverable
      })
    }
    
    // Sanitize concepts (remove internal fields)
    if (sanitizedProposal.concepts) {
      sanitizedProposal.concepts = sanitizedProposal.concepts.map(concept => {
        const {
          created_at: conceptCreatedAt,
          ...sanitizedConcept
        } = concept
        return sanitizedConcept
      })
    }
    
    return sanitizedProposal
  }
  
  /**
   * Check if proposal access should be rate limited
   * @param {string} token - Access token
   * @param {string} ipAddress - Client IP address
   * @returns {Object} Rate limit check result
   */
  static checkRateLimit(token, ipAddress) {
    const rateLimitKey = `proposal_access_${token}_${ipAddress}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const maxRequests = 10 // Max 10 requests per minute
    
    // Get stored access data from sessionStorage (client-side rate limiting)
    const storedData = sessionStorage.getItem(rateLimitKey)
    let accessData = storedData ? JSON.parse(storedData) : { count: 0, windowStart: now }
    
    // Reset window if expired
    if (now - accessData.windowStart > windowMs) {
      accessData = { count: 0, windowStart: now }
    }
    
    // Check if limit exceeded
    if (accessData.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: accessData.windowStart + windowMs
      }
    }
    
    // Increment count and store
    accessData.count++
    sessionStorage.setItem(rateLimitKey, JSON.stringify(accessData))
    
    return {
      allowed: true,
      remaining: maxRequests - accessData.count,
      resetTime: accessData.windowStart + windowMs
    }
  }
  
  /**
   * Revoke proposal token (mark as invalid)
   * @param {string} token - Token to revoke
   * @returns {Object} Revocation result
   */
  static revokeToken(token) {
    try {
      // Store revoked token in localStorage for client-side checking
      const revokedTokens = JSON.parse(localStorage.getItem('revokedProposalTokens') || '[]')
      
      if (!revokedTokens.includes(token)) {
        revokedTokens.push(token)
        localStorage.setItem('revokedProposalTokens', JSON.stringify(revokedTokens))
      }
      
      return {
        success: true,
        message: 'Token revoked successfully'
      }
    } catch (error) {
      console.error('[ProposalSecurityService] Token revocation failed:', error)
      return {
        success: false,
        error: 'Failed to revoke token'
      }
    }
  }
  
  /**
   * Check if token has been revoked
   * @param {string} token - Token to check
   * @returns {boolean} True if token is revoked
   */
  static isTokenRevoked(token) {
    try {
      const revokedTokens = JSON.parse(localStorage.getItem('revokedProposalTokens') || '[]')
      return revokedTokens.includes(token)
    } catch (error) {
      console.error('[ProposalSecurityService] Revocation check failed:', error)
      return false
    }
  }
  
  /**
   * Clean up expired revoked tokens
   */
  static cleanupRevokedTokens() {
    try {
      const revokedTokens = JSON.parse(localStorage.getItem('revokedProposalTokens') || '[]')
      const now = Date.now()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
      
      const validTokens = revokedTokens.filter(token => {
        const validation = this.validateToken(token)
        return validation.valid && (now - validation.timestamp) < maxAge
      })
      
      localStorage.setItem('revokedProposalTokens', JSON.stringify(validTokens))
    } catch (error) {
      console.error('[ProposalSecurityService] Cleanup failed:', error)
    }
  }
}

export default ProposalSecurityService