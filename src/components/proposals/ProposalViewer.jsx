import { useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchProposalByToken,
  toggleDeliverable,
  approveProposal,
  clearError,
  selectViewerProposal,
  selectSelectedDeliverables,
  selectTotalPrice,
  selectViewerLoading,
  selectViewerApproving,
  selectViewerError,
  selectApprovalError
} from '../../store/slices/proposalViewerSlice'
import ConceptGallery from './ConceptGallery'
import DeliverableSelector from './DeliverableSelector'
import ProposalApproval from './ProposalApproval'

const ViewerContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  background: ${props => props.theme?.colors?.background?.primary || '#ffffff'};
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`

const Header = styled.header`
  text-align: center;
  margin-bottom: 48px;
  padding-bottom: 24px;
  border-bottom: 2px solid ${props => props.theme?.colors?.primary || '#007bff'};
  
  h1 {
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 16px 0;
  }
  
  .company-name {
    color: ${props => props.theme?.colors?.primary || '#007bff'};
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .proposal-description {
    color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
    font-size: 16px;
    line-height: 1.5;
  }
`

const Section = styled.section`
  margin-bottom: 48px;
  
  h2 {
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 24px 0;
    padding-bottom: 12px;
    border-bottom: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  }
  
  h3 {
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 16px 0;
  }
`

const RequestSummary = styled.div`
  background: ${props => props.theme?.colors?.background?.secondary || '#f8f9fa'};
  padding: 24px;
  border-radius: 8px;
  border-left: 4px solid ${props => props.theme?.colors?.primary || '#007bff'};
  
  .overview {
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 24px;
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  }
  
  .objectives {
    margin-bottom: 24px;
    
    ul {
      margin: 8px 0 0 0;
      padding-left: 20px;
      
      li {
        margin-bottom: 8px;
        color: ${props => props.theme?.colors?.text?.primary || '#212529'};
      }
    }
  }
  
  .project-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    
    .detail-item {
      .label {
        font-weight: 600;
        color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      
      .value {
        font-size: 16px;
        color: ${props => props.theme?.colors?.text?.primary || '#212529'};
        font-weight: 500;
      }
    }
  }
`

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
`

const ErrorMessage = styled.div`
  background: ${props => props.theme?.colors?.errorLight || '#f8d7da'};
  color: ${props => props.theme?.colors?.error || '#721c24'};
  padding: 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme?.colors?.error || '#f5c6cb'};
  margin-bottom: 24px;
  text-align: center;
  
  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
  }
  
  p {
    margin: 0;
    font-size: 14px;
  }
`

const StatusBadge = styled.div`
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => {
    switch (props.status) {
      case 'approved':
        return `
          background: ${props.theme?.colors?.successLight || '#d4edda'};
          color: ${props.theme?.colors?.success || '#155724'};
        `
      case 'viewed':
        return `
          background: ${props.theme?.colors?.warningLight || '#fff3cd'};
          color: ${props.theme?.colors?.warning || '#856404'};
        `
      default:
        return `
          background: ${props.theme?.colors?.infoLight || '#d1ecf1'};
          color: ${props.theme?.colors?.info || '#0c5460'};
        `
    }
  }}
`

/**
 * Client-facing Proposal Viewer Component
 * Displays proposals to clients with interactive deliverable selection
 * Following PROPOSAL_DEVELOPMENT_GUIDE.md specifications
 * @param {Object} props - Component props
 * @param {string} props.token - Proposal access token (optional, can come from URL)
 */
const ProposalViewer = ({ token: propToken }) => {
  const { token: urlToken } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  
  // Use token from props or URL params
  const token = propToken || urlToken
  
  const proposal = useSelector(selectViewerProposal)
  const selectedDeliverables = useSelector(selectSelectedDeliverables)
  const totalPrice = useSelector(selectTotalPrice)
  const loading = useSelector(selectViewerLoading)
  const approving = useSelector(selectViewerApproving)
  const error = useSelector(selectViewerError)
  const approvalError = useSelector(selectApprovalError)
  
  // Load proposal on mount or token change
  useEffect(() => {
    if (token) {
      dispatch(fetchProposalByToken(token))
    } else {
      navigate('/404')
    }
  }, [dispatch, token, navigate])
  
  // Clear errors on unmount
  useEffect(() => {
    return () => {
      dispatch(clearError())
    }
  }, [dispatch])
  
  const handleDeliverableToggle = useCallback((deliverableId) => {
    dispatch(toggleDeliverable(deliverableId))
  }, [dispatch])
  
  const handleApproval = useCallback(() => {
    if (proposal && selectedDeliverables.length > 0) {
      dispatch(approveProposal({
        proposalId: proposal.id,
        selectedDeliverables,
        totalPrice
      }))
    }
  }, [dispatch, proposal, selectedDeliverables, totalPrice])
  
  // Format currency
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }, [])
  
  // Calculate selected deliverables data
  const selectedDeliverablesData = useMemo(() => {
    if (!proposal?.deliverables) return []
    return proposal.deliverables.filter(d => selectedDeliverables.includes(d.id))
  }, [proposal?.deliverables, selectedDeliverables])
  
  if (loading) {
    return (
      <ViewerContainer>
        <LoadingSpinner>
          Loading proposal...
        </LoadingSpinner>
      </ViewerContainer>
    )
  }
  
  if (error) {
    return (
      <ViewerContainer>
        <ErrorMessage>
          <h3>Unable to Load Proposal</h3>
          <p>{error}</p>
          <p>Please check that your proposal link is correct and hasn't expired.</p>
        </ErrorMessage>
      </ViewerContainer>
    )
  }
  
  if (!proposal) {
    return (
      <ViewerContainer>
        <ErrorMessage>
          <h3>Proposal Not Found</h3>
          <p>The proposal you're looking for doesn't exist or has expired.</p>
        </ErrorMessage>
      </ViewerContainer>
    )
  }
  
  return (
    <ViewerContainer>
      {/* Header */}
      <Header>
        <div className="company-name">Clarity Business Solutions</div>
        <h1>{proposal.title}</h1>
        {proposal.description && (
          <div className="proposal-description">{proposal.description}</div>
        )}
        <div style={{ marginTop: '16px' }}>
          <StatusBadge status={proposal.status}>
            {proposal.status}
          </StatusBadge>
        </div>
      </Header>
      
      {/* Error Messages */}
      {approvalError && (
        <ErrorMessage>
          <h3>Approval Error</h3>
          <p>{approvalError}</p>
        </ErrorMessage>
      )}
      
      {/* Request Summary */}
      {proposal.request_summary && (
        <Section>
          <h2>Project Overview</h2>
          <RequestSummary>
            {proposal.request_summary.overview && (
              <div className="overview">
                {proposal.request_summary.overview}
              </div>
            )}
            
            {proposal.request_summary.objectives && proposal.request_summary.objectives.length > 0 && (
              <div className="objectives">
                <h3>Project Objectives</h3>
                <ul>
                  {proposal.request_summary.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="project-details">
              {proposal.request_summary.timeline && (
                <div className="detail-item">
                  <div className="label">Timeline</div>
                  <div className="value">{proposal.request_summary.timeline}</div>
                </div>
              )}
              
              {proposal.request_summary.budget > 0 && (
                <div className="detail-item">
                  <div className="label">Estimated Budget</div>
                  <div className="value">{formatCurrency(proposal.request_summary.budget)}</div>
                </div>
              )}
              
              <div className="detail-item">
                <div className="label">Total Proposal Value</div>
                <div className="value">{formatCurrency(proposal.total_price || 0)}</div>
              </div>
            </div>
          </RequestSummary>
        </Section>
      )}
      
      {/* Concepts Gallery */}
      {proposal.concepts && proposal.concepts.length > 0 && (
        <Section>
          <h2>Concepts & Designs</h2>
          <ConceptGallery concepts={proposal.concepts} />
        </Section>
      )}
      
      {/* Deliverables Selection */}
      {proposal.deliverables && proposal.deliverables.length > 0 && (
        <Section>
          <h2>Project Deliverables</h2>
          <DeliverableSelector
            deliverables={proposal.deliverables}
            selectedDeliverables={selectedDeliverables}
            onToggleDeliverable={handleDeliverableToggle}
            totalPrice={totalPrice}
            formatCurrency={formatCurrency}
          />
        </Section>
      )}
      
      {/* Approval Section */}
      {proposal.status !== 'approved' && selectedDeliverablesData.length > 0 && (
        <Section>
          <h2>Proposal Approval</h2>
          <ProposalApproval
            proposal={proposal}
            selectedDeliverables={selectedDeliverablesData}
            totalPrice={totalPrice}
            onApprove={handleApproval}
            isApproving={approving}
            formatCurrency={formatCurrency}
          />
        </Section>
      )}
      
      {/* Approved Status */}
      {proposal.status === 'approved' && (
        <Section>
          <div style={{
            background: '#d4edda',
            color: '#155724',
            padding: '24px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '1px solid #c3e6cb'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '24px' }}>
              ✅ Proposal Approved!
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              Thank you for approving this proposal. We'll be in touch shortly with next steps.
            </p>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              Approved Amount: {formatCurrency(proposal.selected_price || 0)}
            </p>
            {proposal.approved_at && (
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                Approved on: {new Date(proposal.approved_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </Section>
      )}
      
      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px 0',
        borderTop: '1px solid #dee2e6',
        marginTop: '48px',
        color: '#6c757d',
        fontSize: '14px'
      }}>
        <p>© {new Date().getFullYear()} Clarity Business Solutions. All rights reserved.</p>
        <p>Questions? Contact us at info@claritybusinesssolutions.ca</p>
      </footer>
    </ViewerContainer>
  )
}

ProposalViewer.propTypes = {
  token: PropTypes.string
}

export default ProposalViewer