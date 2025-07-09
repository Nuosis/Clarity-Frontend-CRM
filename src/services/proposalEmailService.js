import { sendEmailWithAttachment, createHtmlEmailTemplate } from './mailjetService'

/**
 * Proposal Email Service
 * Handles email generation and sending for proposals
 * Following existing mailjetService.js patterns
 */
export class ProposalEmailService {
  /**
   * Send proposal email to customer
   * @param {Object} proposal - Proposal data
   * @param {string} customerEmail - Customer email address
   * @param {string} customerName - Customer name
   * @returns {Promise<Object>} Email send result
   */
  static async sendProposalEmail(proposal, customerEmail, customerName) {
    try {
      const emailContent = this.generateProposalEmailContent(proposal)
      
      const result = await sendEmailWithAttachment({
        to: customerEmail,
        toName: customerName,
        subject: `Project Proposal: ${proposal.title}`,
        html: emailContent,
        // No attachment for proposal emails - link-based access
      })
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('[ProposalEmailService] Send email error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Generate HTML email content for proposal
   * @param {Object} proposal - Proposal data
   * @returns {string} HTML email content
   */
  static generateProposalEmailContent(proposal) {
    const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
    
    return createHtmlEmailTemplate({
      title: `Project Proposal: ${proposal.title}`,
      mainText: `We're excited to present your project proposal. Please review the details and select your preferred deliverables.`,
      buttonText: "View Proposal",
      buttonUrl: proposalUrl,
      footerText: "This proposal link will expire in 30 days."
    })
  }
  
  /**
   * Send proposal approval confirmation email
   * @param {Object} proposal - Approved proposal data
   * @param {string} customerEmail - Customer email address
   * @param {string} customerName - Customer name
   * @param {Array} selectedDeliverables - Selected deliverables
   * @param {number} totalPrice - Total approved price
   * @returns {Promise<Object>} Email send result
   */
  static async sendApprovalConfirmationEmail(proposal, customerEmail, customerName, selectedDeliverables, totalPrice) {
    try {
      const emailContent = this.generateApprovalConfirmationContent(
        proposal, 
        selectedDeliverables, 
        totalPrice
      )
      
      const result = await sendEmailWithAttachment({
        to: customerEmail,
        toName: customerName,
        subject: `Proposal Approved: ${proposal.title}`,
        html: emailContent,
        // MoA attachment would be added here when generated
      })
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('[ProposalEmailService] Send approval confirmation error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Generate approval confirmation email content
   * @param {Object} proposal - Proposal data
   * @param {Array} selectedDeliverables - Selected deliverables
   * @param {number} totalPrice - Total price
   * @returns {string} HTML email content
   */
  static generateApprovalConfirmationContent(proposal, selectedDeliverables, totalPrice) {
    const deliverablesList = selectedDeliverables
      .map(d => `<li>${d.title} - $${d.price.toFixed(2)}</li>`)
      .join('')
    
    return createHtmlEmailTemplate({
      title: `Proposal Approved: ${proposal.title}`,
      mainText: `
        <p>Thank you for approving your project proposal!</p>
        <p><strong>Selected Deliverables:</strong></p>
        <ul>${deliverablesList}</ul>
        <p><strong>Total Project Value:</strong> $${totalPrice.toFixed(2)}</p>
        <p>We'll be in touch shortly with your Memorandum of Agreement and payment details.</p>
      `,
      buttonText: "View Project Status",
      buttonUrl: `${window.location.origin}/proposal/${proposal.access_token}`,
      footerText: "We're excited to work with you on this project!"
    })
  }
  
  /**
   * Send MoA and payment link email
   * @param {Object} proposal - Proposal data
   * @param {string} customerEmail - Customer email address
   * @param {string} customerName - Customer name
   * @param {string} moaUrl - MoA document URL
   * @param {string} paymentUrl - Stripe payment URL
   * @returns {Promise<Object>} Email send result
   */
  static async sendMoAAndPaymentEmail(proposal, customerEmail, customerName, moaUrl, paymentUrl) {
    try {
      const emailContent = this.generateMoAAndPaymentContent(proposal, paymentUrl)
      
      const result = await sendEmailWithAttachment({
        to: customerEmail,
        toName: customerName,
        subject: `Project Agreement & Payment: ${proposal.title}`,
        html: emailContent,
        attachmentUrl: moaUrl // MoA document attachment
      })
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('[ProposalEmailService] Send MoA and payment email error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Generate MoA and payment email content
   * @param {Object} proposal - Proposal data
   * @param {string} paymentUrl - Payment URL
   * @returns {string} HTML email content
   */
  static generateMoAAndPaymentContent(proposal, paymentUrl) {
    const depositAmount = (proposal.selected_price * 0.5).toFixed(2)
    
    return createHtmlEmailTemplate({
      title: `Project Agreement: ${proposal.title}`,
      mainText: `
        <p>Your project agreement is ready!</p>
        <p>Please find your Memorandum of Agreement attached to this email.</p>
        <p><strong>Project Total:</strong> $${proposal.selected_price.toFixed(2)}</p>
        <p><strong>Deposit Required:</strong> $${depositAmount} (50%)</p>
        <p>To begin work on your project, please complete the deposit payment using the secure link below.</p>
      `,
      buttonText: "Pay Deposit ($" + depositAmount + ")",
      buttonUrl: paymentUrl,
      footerText: "Once payment is received, we'll begin work on your project immediately."
    })
  }
  
  /**
   * Send proposal reminder email
   * @param {Object} proposal - Proposal data
   * @param {string} customerEmail - Customer email address
   * @param {string} customerName - Customer name
   * @returns {Promise<Object>} Email send result
   */
  static async sendProposalReminder(proposal, customerEmail, customerName) {
    try {
      const daysUntilExpiry = Math.ceil(
        (new Date(proposal.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
      )
      
      const emailContent = this.generateReminderContent(proposal, daysUntilExpiry)
      
      const result = await sendEmailWithAttachment({
        to: customerEmail,
        toName: customerName,
        subject: `Reminder: Project Proposal - ${proposal.title}`,
        html: emailContent,
      })
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('[ProposalEmailService] Send reminder error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Generate reminder email content
   * @param {Object} proposal - Proposal data
   * @param {number} daysUntilExpiry - Days until proposal expires
   * @returns {string} HTML email content
   */
  static generateReminderContent(proposal, daysUntilExpiry) {
    const proposalUrl = `${window.location.origin}/proposal/${proposal.access_token}`
    
    return createHtmlEmailTemplate({
      title: `Reminder: ${proposal.title}`,
      mainText: `
        <p>This is a friendly reminder about your project proposal.</p>
        <p>Your proposal will expire in <strong>${daysUntilExpiry} days</strong>.</p>
        <p>Please review and approve your proposal to secure your project timeline.</p>
      `,
      buttonText: "Review Proposal",
      buttonUrl: proposalUrl,
      footerText: `Proposal expires on ${new Date(proposal.expires_at).toLocaleDateString()}`
    })
  }
}

export default ProposalEmailService