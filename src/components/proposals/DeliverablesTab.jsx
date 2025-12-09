import { useState, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { createProposalDeliverable, updateProposalDeliverable, deleteProposalDeliverable } from '../../api/proposalExtended';

const Container = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: 8px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const Description = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 14px;
  line-height: 1.5;
`;

const DeliverablesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
`;

const DeliverableCard = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
  cursor: ${props => props.$isDragging ? 'grabbing' : 'grab'};
  opacity: ${props => props.$isDragging ? 0.5 : 1};
  position: relative;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:before {
    content: '⋮⋮';
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: ${props => props.theme.colors.text.tertiary};
    font-size: 14px;
    font-weight: bold;
    letter-spacing: -2px;
    opacity: 0.4;
  }

  &:hover:before {
    opacity: 0.8;
  }
`;

const DeliverableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: ${props => props.$isExpanded ? '12px' : '0'};
  padding-left: 20px;
  cursor: pointer;
`;

const CollapsedTitle = styled.div`
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const ExpandIcon = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.text.secondary};
  transition: transform 0.2s ease;
  transform: ${props => props.$isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};
  display: inline-block;
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const CollapsedMeta = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: ${props => props.theme.colors.text.secondary};
`;

const ExpandedContent = styled.div`
  display: ${props => props.$isExpanded ? 'block' : 'none'};
  margin-left: 20px;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primaryLight};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.tertiary};
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 8px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 12px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primaryLight};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.tertiary};
  }
`;

const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-size: 13px;
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const TypeBadge = styled.span`
  background: ${props => {
    if (props.type === 'fixed') return props.theme.colors.deliverable.fixed;
    if (props.type === 'hourly') return props.theme.colors.deliverable.hourly;
    if (props.type === 'subscription') return props.theme.colors.deliverable.subscription;
    return props.theme.colors.text.secondary;
  }};
  color: white;
  padding: 4px 10px;
  border-radius: ${props => props.theme.radius.full};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SmallInput = styled(Input)`
  width: 100px;
`;

const Label = styled.label`
  font-size: 13px;
  color: ${props => props.theme.colors.text.secondary};
  white-space: nowrap;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: ${props => props.theme.colors.text.secondary};

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: ${props => props.theme.colors.primary};
  }
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.danger};
  cursor: pointer;
  padding: 4px 8px;
  font-size: 20px;
  line-height: 1;
  transition: all 0.2s ease;
  align-self: flex-start;

  &:hover {
    color: ${props => props.theme.colors.dangerDark};
    transform: scale(1.1);
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 2px solid ${props => props.theme.colors.border};
`;

const AddButton = styled.button`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.primaryDark};
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const CancelButton = styled.button`
  background: none;
  color: ${props => props.theme.colors.text.secondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.background.secondary};
    border-color: ${props => props.theme.colors.text.secondary};
  }
`;

const TotalSummary = styled.div`
  text-align: right;
  font-size: 14px;
  color: ${props => props.theme.colors.text.secondary};

  strong {
    font-size: 18px;
    color: ${props => props.theme.colors.primary};
    font-weight: 600;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: ${props => props.theme.colors.text.secondary};
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

/**
 * DeliverablesTab Component
 * Manages proposal deliverables with support for fixed, hourly, and subscription types
 *
 * @param {Object} props - Component props
 * @param {Array} props.deliverables - Array of deliverable objects
 * @param {Function} props.onChange - Callback when deliverables change
 * @param {Function} props.onCancel - Optional callback for cancel action
 * @param {string} props.proposalId - Proposal ID (required for database operations)
 */
const DeliverablesTab = ({ deliverables = [], onChange, onCancel, proposalId }) => {
  const [saving, setSaving] = useState(false);
  const updateTimeouts = useRef({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  // Debug log to see what data is passed to component
  console.log('[DeliverablesTab] Rendered with deliverables:', deliverables, 'proposalId:', proposalId);

  const toggleCard = useCallback((index) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }, []);

  const handleDeliverableChange = useCallback(async (index, field, value) => {
    const deliverable = deliverables[index];
    const newDeliverables = [...deliverables];
    newDeliverables[index] = { ...newDeliverables[index], [field]: value };
    onChange(newDeliverables);

    // Auto-save to database
    if (deliverable.dbId && proposalId) {
      // Map UI fields to backend fields
      const updateData = {};
      if (field === 'title') updateData.title = value;
      if (field === 'description') updateData.description = value;
      if (field === 'price') updateData.price = value;
      if (field === 'type') updateData.type = value;
      if (field === 'estimated_time') updateData.estimated_time = value;
      if (field === 'billing_interval') updateData.billing_interval = value;
      if (field === 'is_required') updateData.is_required = value;
      if (field === 'subscription_duration_months') updateData.subscription_duration_months = value;

      // For select fields and checkboxes, update immediately
      const immediateFields = ['type', 'billing_interval', 'is_required'];

      if (immediateFields.includes(field)) {
        console.log('[DeliverablesTab] Updating deliverable field immediately:', field, 'value:', value, 'dbId:', deliverable.dbId);
        const result = await updateProposalDeliverable(deliverable.dbId, updateData);
        if (!result.success) {
          console.error('[DeliverablesTab] Failed to update deliverable:', result.error);
        } else {
          console.log('[DeliverablesTab] Successfully updated deliverable field:', field);
        }
      } else {
        // For text/number inputs, debounce to avoid too many requests
        if (updateTimeouts.current[deliverable.dbId]) {
          clearTimeout(updateTimeouts.current[deliverable.dbId]);
        }

        updateTimeouts.current[deliverable.dbId] = setTimeout(async () => {
          console.log('[DeliverablesTab] Updating deliverable field (debounced):', field, 'value:', value, 'dbId:', deliverable.dbId);
          const result = await updateProposalDeliverable(deliverable.dbId, updateData);
          if (!result.success) {
            console.error('[DeliverablesTab] Failed to update deliverable:', result.error);
          } else {
            console.log('[DeliverablesTab] Successfully updated deliverable field:', field);
          }

          delete updateTimeouts.current[deliverable.dbId];
        }, 1000);
      }
    }
  }, [deliverables, onChange, proposalId]);

  const addDeliverable = useCallback(async () => {
    console.log('[DeliverablesTab] addDeliverable called, proposalId:', proposalId);

    if (!proposalId) {
      // If no proposalId yet (creating new proposal), just add to local state
      console.log('[DeliverablesTab] No proposalId, adding to local state only');
      onChange([
        ...deliverables,
        {
          id: crypto.randomUUID(),
          title: 'New Deliverable',
          description: '',
          price: 0,
          type: 'fixed',
          estimated_time: 0,
          billing_interval: 'monthly',
          subscription_duration_months: null,
          is_required: false,
          order: deliverables.length
        }
      ]);
      return;
    }

    setSaving(true);
    try {
      // Create deliverable in database immediately
      const deliverableData = {
        proposal_id: proposalId,
        title: 'New Deliverable',
        description: '',
        price: 0,
        type: 'fixed',
        estimated_time: 0,
        billing_interval: 'monthly',
        is_required: false,
        sort_order: deliverables.length
      };

      console.log('[DeliverablesTab] Creating deliverable with data:', deliverableData);
      const result = await createProposalDeliverable(deliverableData);
      console.log('[DeliverablesTab] Create result:', result);

      if (result.success) {
        // Add to local state with database ID
        const newDeliverable = {
          id: crypto.randomUUID(), // Local temp ID for React key
          dbId: result.data.id, // Database ID for updates
          title: result.data.title || '',
          description: result.data.description || '',
          price: parseFloat(result.data.price) || 0, // Convert string to number
          type: result.data.type || 'fixed',
          estimated_time: parseInt(result.data.estimated_time) || 0, // Convert to integer
          billing_interval: result.data.billing_interval || 'monthly',
          subscription_duration_months: result.data.subscription_duration_months ? parseInt(result.data.subscription_duration_months) : null,
          is_required: result.data.is_required || false,
          order: result.data.sort_order || deliverables.length
        };
        onChange([...deliverables, newDeliverable]);
      } else {
        console.error('[DeliverablesTab] Failed to create deliverable:', result.error);
        alert('Failed to create deliverable. Please try again.');
      }
    } catch (error) {
      console.error('[DeliverablesTab] Error creating deliverable:', error);
      alert('Error creating deliverable. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [deliverables, onChange, proposalId]);

  const removeDeliverable = useCallback(async (index) => {
    const deliverable = deliverables[index];

    // Remove from local state immediately
    const newDeliverables = deliverables.filter((_, i) => i !== index);
    onChange(newDeliverables);

    // Delete from database if it has a database ID
    if (deliverable.dbId && proposalId) {
      const result = await deleteProposalDeliverable(deliverable.dbId);
      if (!result.success) {
        console.error('[DeliverablesTab] Failed to delete deliverable:', result.error);
        // Optionally: revert the local state change if delete fails
      }
    }
  }, [deliverables, onChange, proposalId]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder the deliverables array
    const newDeliverables = [...deliverables];
    const draggedItem = newDeliverables[draggedIndex];

    // Remove from old position
    newDeliverables.splice(draggedIndex, 1);
    // Insert at new position
    newDeliverables.splice(index, 0, draggedItem);

    // Update order field for all items
    const updatedDeliverables = newDeliverables.map((item, idx) => ({
      ...item,
      order: idx
    }));

    onChange(updatedDeliverables);
    setDraggedIndex(index);
  }, [draggedIndex, deliverables, onChange]);

  const handleDragEnd = useCallback(async () => {
    setDraggedIndex(null);

    // Update sort_order in database for all deliverables
    if (proposalId) {
      console.log('[DeliverablesTab] Updating sort order after drag, deliverables:', deliverables);

      const updatePromises = deliverables.map((deliverable, index) => {
        if (deliverable.dbId) {
          console.log(`[DeliverablesTab] Updating deliverable ${deliverable.dbId} to sort_order ${index}`);
          return updateProposalDeliverable(deliverable.dbId, { sort_order: index });
        }
        return Promise.resolve();
      });

      const results = await Promise.all(updatePromises);
      console.log('[DeliverablesTab] Sort order update results:', results);
      console.log('[DeliverablesTab] Updated sort order for all deliverables');
    }
  }, [deliverables, proposalId]);

  const totalPrice = useMemo(() => {
    return deliverables.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);
  }, [deliverables]);

  return (
    <Container>
      <Header>
        <HeaderContent>
          <Title>Deliverables</Title>
          <Description>
            Define what you'll deliver to the customer. Include fixed-price items, hourly work,
            and recurring subscriptions.
          </Description>
        </HeaderContent>
      </Header>
      <DeliverablesList>
        {deliverables.map((deliverable, index) => {
          const isExpanded = expandedCards[index];

          return (
            <DeliverableCard
              key={deliverable.id || index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              $isDragging={draggedIndex === index}
            >
              <DeliverableHeader
                $isExpanded={isExpanded}
                onClick={(e) => {
                  // Don't toggle if clicking on input or button
                  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                    toggleCard(index);
                  }
                }}
              >
                {!isExpanded ? (
                  <>
                    <CollapsedTitle>
                      <ExpandIcon $isExpanded={isExpanded}>▶</ExpandIcon>
                      {deliverable.title || 'Untitled Deliverable'}
                    </CollapsedTitle>
                    <CollapsedMeta>
                      <TypeBadge type={deliverable.type}>
                        {deliverable.type || 'fixed'}
                      </TypeBadge>
                      <span>${parseFloat(deliverable.price || 0).toFixed(2)}</span>
                    </CollapsedMeta>
                    <CardActions>
                      <RemoveButton
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDeliverable(index);
                        }}
                        title="Remove deliverable"
                      >
                        ×
                      </RemoveButton>
                    </CardActions>
                  </>
                ) : (
                  <>
                    <ExpandIcon $isExpanded={isExpanded}>▶</ExpandIcon>
                    <Input
                      type="text"
                      value={deliverable.title || ''}
                      onChange={(e) => handleDeliverableChange(index, 'title', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Deliverable title (e.g., 'Website Design & Development')"
                    />
                    <RemoveButton
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDeliverable(index);
                      }}
                      title="Remove deliverable"
                    >
                      ×
                    </RemoveButton>
                  </>
                )}
              </DeliverableHeader>

              <ExpandedContent $isExpanded={isExpanded}>
                <TextArea
                  value={deliverable.description || ''}
                  onChange={(e) => handleDeliverableChange(index, 'description', e.target.value)}
                  placeholder="Describe what's included in this deliverable..."
                  rows={2}
                />

                <MetaRow>
              <InputGroup>
                <Label>Type:</Label>
                <Select
                  value={deliverable.type || 'fixed'}
                  onChange={(e) => handleDeliverableChange(index, 'type', e.target.value)}
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="subscription">Subscription</option>
                </Select>
                <TypeBadge type={deliverable.type}>
                  {deliverable.type || 'fixed'}
                </TypeBadge>
              </InputGroup>

              <InputGroup>
                <Label>Price:</Label>
                <SmallInput
                  type="number"
                  value={deliverable.price || ''}
                  onChange={(e) => handleDeliverableChange(index, 'price', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </InputGroup>

              {deliverable.type === 'hourly' && (
                <InputGroup>
                  <Label>Hours:</Label>
                  <SmallInput
                    type="number"
                    value={deliverable.estimated_time || ''}
                    onChange={(e) => handleDeliverableChange(index, 'estimated_time', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                  />
                </InputGroup>
              )}

              {deliverable.type === 'subscription' && (
                <InputGroup>
                  <Label>Billing:</Label>
                  <Select
                    value={deliverable.billing_interval || 'monthly'}
                    onChange={(e) => handleDeliverableChange(index, 'billing_interval', e.target.value)}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </InputGroup>
              )}

              <CheckboxLabel>
                <input
                  type="checkbox"
                  checked={deliverable.is_required === true}
                  onChange={(e) => handleDeliverableChange(index, 'is_required', e.target.checked)}
                />
                <span>Required</span>
              </CheckboxLabel>
            </MetaRow>
              </ExpandedContent>
            </DeliverableCard>
          );
        })}
      </DeliverablesList>
      <Footer>
        <AddButton onClick={addDeliverable} disabled={saving}>
          {saving ? 'Adding...' : '+ Add Deliverable'}
        </AddButton>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {deliverables.length > 0 && (
            <TotalSummary>
              Total: <strong>${totalPrice.toFixed(2)}</strong>
            </TotalSummary>
          )}
          {onCancel && (
            <CancelButton onClick={onCancel}>
              Cancel
            </CancelButton>
          )}
        </div>
      </Footer>
    </Container>
  );
};

DeliverablesTab.propTypes = {
  deliverables: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      dbId: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      price: PropTypes.number,
      type: PropTypes.oneOf(['fixed', 'hourly', 'subscription']),
      estimated_time: PropTypes.number,
      billing_interval: PropTypes.oneOf(['weekly', 'monthly', 'quarterly', 'yearly']),
      subscription_duration_months: PropTypes.number,
      is_required: PropTypes.bool,
      order: PropTypes.number
    })
  ),
  onChange: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  proposalId: PropTypes.string
};

export default DeliverablesTab;
