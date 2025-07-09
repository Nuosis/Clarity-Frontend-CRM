import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const ApprovalContainer = styled.div`
  background: ${props => props.theme?.colors?.background?.secondary || '#f8f9fa'};
  border-radius: 8px;
  padding: 32px;
  border: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  text-align: center;
`

const ApprovalSummary = styled.div`
  background: ${props => props.theme?.colors?.background?.primary || '#ffffff'};
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
`

const SummaryTitle = styled.h3`
  margin: 0 0 20px 0;
  color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  font-size: 20px;
  font-weight: 600;
`

const SelectedItemsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
  text-align: left;
`

const SelectedItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  
  &:last-child {
    border-bottom: none;
  }
  
  .item-name {
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
    font-weight: 500;
  }
  
  .item-price {
    color: ${props => props.theme?.colors?.primary || '#007bff'};
    font-weight: 600;
  }
`

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-top: 2px solid ${props => props.theme?.colors?.primary || '#007bff'};
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme?.colors?.primary || '#007bff'};
`

const PaymentInfo = styled.div`
  background: ${props => props.theme?.colors?.infoLight || '#d1ecf1'};
  color: ${props => props.theme?.colors?.info || '#0c5460'};
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 14px;
  line-height: 1.5;
  
  .deposit-amount {
    font-weight: 600;
    font-size: 16px;
  }
`

const ApprovalButton = styled.button`
  background: ${props => props.theme?.colors?.success || '#28a745'};
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
  
  &:hover:not(:disabled) {
    background: ${props => props.theme?.colors?.successDark || '#218838'};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }
  
  &:disabled {
    background: ${props => props.theme?.colors?.secondary || '#6c757d'};
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
`

const ConfirmationCheckbox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
  font-size: 14px;
  color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: ${props => props.theme?.colors?.primary || '#007bff'};
    cursor: pointer;
  }
  
  label {
    cursor: pointer;
    line-height: 1.4;
  }
`

const TermsText = styled.div`
  font-size: 12px;
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
  line-height: 1.4;
  margin-bottom: 24px;
  text-align: left;
  
  p {
    margin: 0 0 8px 0;
  }
  
  ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  li {
    margin-bottom: 4px;
  }
`

const LoadingSpinner = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

/**
 * Proposal Approval Component
 * Handles the final approval workflow for proposals
 * @param {Object} props - Component props
 * @param {Object} props.proposal - Proposal data
 * @param {Array} props.selectedDeliverables - Selected deliverables
 * @param {number} props.totalPrice - Total price
 * @param {Function} props.onApprove - Approval callback
 * @param {boolean} props.isApproving - Loading state
 * @param {Function} props.formatCurrency - Currency formatting function
 */
const ProposalApproval = ({ 
  proposal, 
  selectedDeliverables, 
  totalPrice, 
  onApprove, 
  isApproving,
  formatCurrency 
}) => {
  const [isConfirmed, setIsConfirmed] = useState(false)
  
  const handleConfirmationChange = useCallback((event) => {
    setIsConfirmed(event.target.checked)
  }, [])
  
  const handleApprove = useCallback(() => {
    if (isConfirmed && !isApproving) {
      onApprove()
    }
  }, [isConfirmed, isApproving, onApprove])
  
  const depositAmount = totalPrice * 0.5
  const remainingAmount = totalPrice - depositAmount
  
  if (!selectedDeliverables || selectedDeliverables.length === 0) {
    return (
      <ApprovalContainer>
        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
          Please select at least one deliverable to proceed with approval.
        </p>
      </ApprovalContainer>
    )
  }
  
  return (
    <ApprovalContainer>
      <ApprovalSummary>
        <SummaryTitle>Approval Summary</SummaryTitle>
        
        <SelectedItemsList>
          {selectedDeliverables.map((deliverable) => (
            <SelectedItem key={deliverable.id}>
              <span className="item-name">
                {deliverable.title}
                {deliverable.is_required && ' (Required)'}
              </span>
              <span className="item-price">
                {formatCurrency(deliverable.price)}
              </span>
            </SelectedItem>
          ))}
        </SelectedItemsList>
        
        <TotalRow>
          <span>Total Project Value</span>
          <span>{formatCurrency(totalPrice)}</span>
        </TotalRow>
      </ApprovalSummary>
      
      <PaymentInfo>
        <p>
          <strong>Payment Terms:</strong>
        </p>
        <p className="deposit-amount">
          • Deposit Required: {formatCurrency(depositAmount)} (50%)
        </p>
        <p>
          • Remaining Balance: {formatCurrency(remainingAmount)} (due upon completion)
        </p>
        <p style={{ marginTop: '12px' }}>
          Upon approval, you'll receive a secure payment link to complete your deposit. 
          Work will begin immediately after payment confirmation.
        </p>
      </PaymentInfo>
      
      <TermsText>
        <p><strong>Terms & Conditions:</strong></p>
        <ul>
          <li>This proposal is valid for 30 days from the date of issue</li>
          <li>A 50% deposit is required to begin work on your project</li>
          <li>The remaining 50% is due upon project completion</li>
          <li>Project timeline begins after deposit payment is received</li>
          <li>Any changes to the approved scope may result in additional charges</li>
          <li>You will receive a detailed Memorandum of Agreement after approval</li>
        </ul>
      </TermsText>
      
      <ConfirmationCheckbox>
        <input
          type="checkbox"
          id="approval-confirmation"
          checked={isConfirmed}
          onChange={handleConfirmationChange}
          disabled={isApproving}
        />
        <label htmlFor="approval-confirmation">
          I have reviewed the selected deliverables and agree to the terms and conditions. 
          I authorize Clarity Business Solutions to proceed with this project.
        </label>
      </ConfirmationCheckbox>
      
      <ApprovalButton
        onClick={handleApprove}
        disabled={!isConfirmed || isApproving}
        aria-label={isApproving ? 'Processing approval...' : 'Approve proposal'}
      >
        {isApproving ? (
          <LoadingSpinner>
            <div className="spinner" />
            Processing...
          </LoadingSpinner>
        ) : (
          `Approve Proposal - ${formatCurrency(totalPrice)}`
        )}
      </ApprovalButton>
      
      <p style={{ 
        fontSize: '12px', 
        color: '#6c757d', 
        marginTop: '16px',
        lineHeight: 1.4 
      }}>
        By clicking "Approve Proposal", you are entering into a binding agreement 
        with Clarity Business Solutions for the selected deliverables and total amount shown above.
      </p>
    </ApprovalContainer>
  )
}

ProposalApproval.propTypes = {
  proposal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired
  }).isRequired,
  selectedDeliverables: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      price: PropTypes.number.isRequired,
      is_required: PropTypes.bool
    })
  ).isRequired,
  totalPrice: PropTypes.number.isRequired,
  onApprove: PropTypes.func.isRequired,
  isApproving: PropTypes.bool,
  formatCurrency: PropTypes.func.isRequired
}

ProposalApproval.defaultProps = {
  isApproving: false
}

export default ProposalApproval