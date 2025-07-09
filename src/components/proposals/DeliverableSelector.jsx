import { useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const SelectorContainer = styled.div`
  background: ${props => props.theme?.colors?.background?.secondary || '#f8f9fa'};
  border-radius: 8px;
  padding: 24px;
  border: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
`

const DeliverableList = styled.div`
  margin-bottom: 24px;
`

const DeliverableItem = styled.div`
  background: ${props => props.theme?.colors?.background?.primary || '#ffffff'};
  border: 2px solid ${props => props.isSelected 
    ? props.theme?.colors?.primary || '#007bff'
    : props.theme?.colors?.border || '#dee2e6'};
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  cursor: ${props => props.isRequired ? 'default' : 'pointer'};
  opacity: ${props => props.isRequired ? 0.8 : 1};
  
  &:hover {
    ${props => !props.isRequired && `
      border-color: ${props.theme?.colors?.primary || '#007bff'};
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    `}
  }
  
  ${props => props.isSelected && `
    background: ${props.theme?.colors?.primaryLight || '#e3f2fd'};
  `}
`

const DeliverableHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`

const Checkbox = styled.input`
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: ${props => props.disabled ? 'default' : 'pointer'};
  accent-color: ${props => props.theme?.colors?.primary || '#007bff'};
`

const DeliverableContent = styled.div`
  flex: 1;
`

const DeliverableTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  display: flex;
  align-items: center;
  gap: 8px;
`

const RequiredBadge = styled.span`
  background: ${props => props.theme?.colors?.warning || '#ffc107'};
  color: ${props => props.theme?.colors?.warningText || '#856404'};
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const DeliverableDescription = styled.p`
  margin: 0 0 12px 0;
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
  line-height: 1.5;
  font-size: 14px;
`

const DeliverableDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
`

const PriceDisplay = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme?.colors?.primary || '#007bff'};
`

const TypeBadge = styled.span`
  background: ${props => props.theme?.colors?.secondary || '#6c757d'};
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
`

const TotalSection = styled.div`
  border-top: 2px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  padding-top: 24px;
  text-align: center;
`

const TotalBreakdown = styled.div`
  background: ${props => props.theme?.colors?.background?.primary || '#ffffff'};
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
`

const BreakdownItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  
  &:last-child {
    border-bottom: none;
    font-weight: 600;
    font-size: 18px;
    color: ${props => props.theme?.colors?.primary || '#007bff'};
    margin-top: 8px;
    padding-top: 16px;
    border-top: 2px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  }
  
  .item-name {
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  }
  
  .item-price {
    font-weight: 500;
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  }
`

const SelectionSummary = styled.div`
  font-size: 14px;
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
  margin-bottom: 16px;
`

/**
 * Deliverable Selector Component
 * Interactive component for selecting proposal deliverables with real-time pricing
 * @param {Object} props - Component props
 * @param {Array} props.deliverables - Array of deliverable objects
 * @param {Array} props.selectedDeliverables - Array of selected deliverable IDs
 * @param {Function} props.onToggleDeliverable - Callback for toggling deliverable selection
 * @param {number} props.totalPrice - Current total price
 * @param {Function} props.formatCurrency - Currency formatting function
 */
const DeliverableSelector = ({ 
  deliverables, 
  selectedDeliverables, 
  onToggleDeliverable, 
  totalPrice,
  formatCurrency 
}) => {
  const handleToggle = useCallback((deliverableId, isRequired) => {
    if (!isRequired) {
      onToggleDeliverable(deliverableId)
    }
  }, [onToggleDeliverable])
  
  const selectedDeliverablesData = useMemo(() => {
    return deliverables.filter(d => selectedDeliverables.includes(d.id))
  }, [deliverables, selectedDeliverables])
  
  const requiredDeliverables = useMemo(() => {
    return deliverables.filter(d => d.is_required)
  }, [deliverables])
  
  const optionalDeliverables = useMemo(() => {
    return deliverables.filter(d => !d.is_required)
  }, [deliverables])
  
  const selectedCount = selectedDeliverables.length
  const totalCount = deliverables.length
  
  if (!deliverables || deliverables.length === 0) {
    return (
      <SelectorContainer>
        <p style={{ textAlign: 'center', color: '#6c757d' }}>
          No deliverables available for this proposal.
        </p>
      </SelectorContainer>
    )
  }
  
  return (
    <SelectorContainer>
      <SelectionSummary>
        {selectedCount} of {totalCount} deliverables selected
        {requiredDeliverables.length > 0 && (
          <span> • {requiredDeliverables.length} required</span>
        )}
      </SelectionSummary>
      
      <DeliverableList>
        {/* Required Deliverables */}
        {requiredDeliverables.length > 0 && (
          <>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#212529', 
              fontSize: '16px',
              fontWeight: 600 
            }}>
              Required Deliverables
            </h3>
            {requiredDeliverables
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((deliverable) => (
                <DeliverableItem
                  key={deliverable.id}
                  isSelected={true}
                  isRequired={true}
                >
                  <DeliverableHeader>
                    <Checkbox
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      readOnly
                    />
                    <DeliverableContent>
                      <DeliverableTitle>
                        {deliverable.title}
                        <RequiredBadge>Required</RequiredBadge>
                      </DeliverableTitle>
                      
                      {deliverable.description && (
                        <DeliverableDescription>
                          {deliverable.description}
                        </DeliverableDescription>
                      )}
                      
                      <DeliverableDetails>
                        <TypeBadge>{deliverable.type}</TypeBadge>
                        {deliverable.type === 'hourly' && deliverable.estimated_hours && (
                          <span>~{deliverable.estimated_hours} hours</span>
                        )}
                        <PriceDisplay>
                          {formatCurrency(deliverable.price)}
                        </PriceDisplay>
                      </DeliverableDetails>
                    </DeliverableContent>
                  </DeliverableHeader>
                </DeliverableItem>
              ))}
          </>
        )}
        
        {/* Optional Deliverables */}
        {optionalDeliverables.length > 0 && (
          <>
            {requiredDeliverables.length > 0 && (
              <h3 style={{ 
                margin: '24px 0 16px 0', 
                color: '#212529', 
                fontSize: '16px',
                fontWeight: 600 
              }}>
                Optional Deliverables
              </h3>
            )}
            {optionalDeliverables
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((deliverable) => {
                const isSelected = selectedDeliverables.includes(deliverable.id)
                
                return (
                  <DeliverableItem
                    key={deliverable.id}
                    isSelected={isSelected}
                    isRequired={false}
                    onClick={() => handleToggle(deliverable.id, false)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleToggle(deliverable.id, false)
                      }
                    }}
                  >
                    <DeliverableHeader>
                      <Checkbox
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(deliverable.id, false)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <DeliverableContent>
                        <DeliverableTitle>
                          {deliverable.title}
                        </DeliverableTitle>
                        
                        {deliverable.description && (
                          <DeliverableDescription>
                            {deliverable.description}
                          </DeliverableDescription>
                        )}
                        
                        <DeliverableDetails>
                          <TypeBadge>{deliverable.type}</TypeBadge>
                          {deliverable.type === 'hourly' && deliverable.estimated_hours && (
                            <span>~{deliverable.estimated_hours} hours</span>
                          )}
                          <PriceDisplay>
                            {formatCurrency(deliverable.price)}
                          </PriceDisplay>
                        </DeliverableDetails>
                      </DeliverableContent>
                    </DeliverableHeader>
                  </DeliverableItem>
                )
              })}
          </>
        )}
      </DeliverableList>
      
      {/* Total Section */}
      <TotalSection>
        <TotalBreakdown>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            color: '#212529', 
            fontSize: '18px',
            fontWeight: 600 
          }}>
            Selected Deliverables
          </h3>
          
          {selectedDeliverablesData.length === 0 ? (
            <p style={{ 
              color: '#6c757d', 
              fontStyle: 'italic',
              margin: 0 
            }}>
              No deliverables selected
            </p>
          ) : (
            <>
              {selectedDeliverablesData.map((deliverable) => (
                <BreakdownItem key={deliverable.id}>
                  <span className="item-name">
                    {deliverable.title}
                    {deliverable.is_required && ' (Required)'}
                  </span>
                  <span className="item-price">
                    {formatCurrency(deliverable.price)}
                  </span>
                </BreakdownItem>
              ))}
              
              <BreakdownItem>
                <span className="item-name">Total Project Value</span>
                <span className="item-price">{formatCurrency(totalPrice)}</span>
              </BreakdownItem>
            </>
          )}
        </TotalBreakdown>
        
        {selectedDeliverablesData.length > 0 && (
          <p style={{ 
            fontSize: '14px', 
            color: '#6c757d',
            margin: 0,
            lineHeight: 1.5 
          }}>
            A 50% deposit ({formatCurrency(totalPrice * 0.5)}) will be required to begin work.
            <br />
            The remaining balance will be due upon project completion.
          </p>
        )}
      </TotalSection>
    </SelectorContainer>
  )
}

DeliverableSelector.propTypes = {
  deliverables: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      price: PropTypes.number.isRequired,
      type: PropTypes.oneOf(['fixed', 'hourly']).isRequired,
      estimated_hours: PropTypes.number,
      is_selected: PropTypes.bool,
      is_required: PropTypes.bool,
      order: PropTypes.number
    })
  ).isRequired,
  selectedDeliverables: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleDeliverable: PropTypes.func.isRequired,
  totalPrice: PropTypes.number.isRequired,
  formatCurrency: PropTypes.func.isRequired
}

export default DeliverableSelector