import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useProposalRequirements } from '../../hooks/useProposalExtended';

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

const RequirementsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
`;

const RequirementCard = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const RequirementHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`;

const RequirementTitle = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
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

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const CategoryBadge = styled.span`
  background: ${props => {
    const cat = props.category;
    if (cat === 'content') return props.theme.colors.requirement.content;
    if (cat === 'access') return props.theme.colors.requirement.access;
    if (cat === 'assets') return props.theme.colors.requirement.assets;
    if (cat === 'documentation') return props.theme.colors.requirement.documentation;
    if (cat === 'credentials') return props.theme.colors.requirement.credentials;
    if (cat === 'other') return props.theme.colors.requirement.other;
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

const PriorityBadge = styled.span`
  background: ${props => {
    const pri = props.priority;
    if (pri === 'critical') return props.theme.colors.priority.critical;
    if (pri === 'high') return props.theme.colors.priority.high;
    if (pri === 'medium') return props.theme.colors.priority.medium;
    if (pri === 'low') return props.theme.colors.priority.low;
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

const InfoBox = styled.div`
  background: ${props => props.theme?.colors?.info || '#d1ecf1'};
  border: 1px solid ${props => props.theme?.colors?.infoBorder || '#bee5eb'};
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 20px;
  font-size: 13px;
  color: ${props => props.theme?.colors?.infoText || '#0c5460'};
  line-height: 1.5;
`;

/**
 * RequiredFromCustomer Component
 * Manages requirements that the customer must provide to satisfy deliverables
 * Integrated with backend API via useProposalRequirements hook
 *
 * @param {Object} props - Component props
 * @param {string} props.proposalId - Proposal ID for fetching requirements
 * @param {Function} props.onChange - Optional callback when requirements change (for parent state sync)
 */
const RequiredFromCustomer = ({ proposalId, onChange }) => {
  console.log('[RequiredFromCustomer] Component rendering with proposalId:', proposalId, 'type:', typeof proposalId);
  const {
    requirements,
    loading,
    error,
    createRequirement,
    updateRequirement,
    deleteRequirement,
    refresh
  } = useProposalRequirements(proposalId);

  const [localRequirements, setLocalRequirements] = useState([]);

  // Sync API requirements to local state
  useEffect(() => {
    if (requirements && requirements.length > 0) {
      setLocalRequirements(requirements);
      // Notify parent of changes if callback provided
      if (onChange) {
        onChange(requirements);
      }
    }
  }, [requirements, onChange]);

  const handleRequirementChange = useCallback(async (index, field, value) => {
    const requirement = localRequirements[index];

    // Update local state immediately for responsive UI
    const newRequirements = [...localRequirements];
    newRequirements[index] = { ...newRequirements[index], [field]: value };
    setLocalRequirements(newRequirements);

    // Notify parent for local-only mode (no proposalId yet)
    if (onChange) {
      onChange(newRequirements);
    }

    // If requirement has an ID and we have proposalId, update in DB
    if (proposalId && requirement.id && !requirement.id.startsWith('temp-')) {
      const updateData = { [field]: value };
      await updateRequirement(requirement.id, updateData);
    }
  }, [localRequirements, updateRequirement, proposalId, onChange]);

  const addRequirement = useCallback(async () => {
    // Create temporary requirement in UI
    const tempRequirement = {
      id: `temp-${Date.now()}`,
      title: 'New Requirement',
      description: '',
      category: 'content',
      priority: 'medium',
      is_required: true
    };

    const newRequirements = [...localRequirements, tempRequirement];
    setLocalRequirements(newRequirements);

    // Notify parent for local-only mode
    if (onChange) {
      onChange(newRequirements);
    }

    // Create in database if proposalId exists
    if (proposalId) {
      const result = await createRequirement({
        proposal_id: proposalId,
        title: 'New Requirement',
        description: '',
        category: 'content',
        priority: 'medium',
        is_required: true,
        order_index: localRequirements.length
      });

      if (result.success) {
        // Refresh to get the real ID from backend
        refresh();
      }
    }
  }, [localRequirements, proposalId, createRequirement, refresh, onChange]);

  const removeRequirement = useCallback(async (index) => {
    const requirement = localRequirements[index];

    // Remove from local state immediately
    const newRequirements = localRequirements.filter((_, i) => i !== index);
    setLocalRequirements(newRequirements);

    // Notify parent for local-only mode
    if (onChange) {
      onChange(newRequirements);
    }

    // Delete from database if it has a real ID and we have proposalId
    if (proposalId && requirement.id && !requirement.id.startsWith('temp-')) {
      await deleteRequirement(requirement.id);
    }
  }, [localRequirements, deleteRequirement, proposalId, onChange]);

  if (loading && localRequirements.length === 0) {
    return (
      <Container>
        <EmptyState>
          <EmptyIcon>⏳</EmptyIcon>
          <p>Loading requirements...</p>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderContent>
          <Title>Required From Customer</Title>
          <Description>
            Specify what the customer must provide (content, access, credentials, etc.)
            for you to complete the deliverables. This helps set clear expectations.
          </Description>
        </HeaderContent>
      </Header>

      {error && (
        <InfoBox style={{ background: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24' }}>
          Error loading requirements: {error}
        </InfoBox>
      )}
        <>
          <RequirementsList>
            {localRequirements.map((requirement, index) => (
              <RequirementCard key={requirement.id || index}>
                <RequirementHeader>
                  <RequirementTitle>
                    <Input
                      type="text"
                      value={requirement.title || ''}
                      onChange={(e) => handleRequirementChange(index, 'title', e.target.value)}
                      placeholder="Requirement title (e.g., 'Logo files in SVG format')"
                    />
                  </RequirementTitle>
                  <RemoveButton
                    onClick={() => removeRequirement(index)}
                    title="Remove requirement"
                  >
                    ×
                  </RemoveButton>
                </RequirementHeader>

                <TextArea
                  value={requirement.description || ''}
                  onChange={(e) => handleRequirementChange(index, 'description', e.target.value)}
                  placeholder="Provide detailed description of what is needed..."
                  rows={2}
                />

                <MetaRow>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#6c757d' }}>Category:</label>
                    <Select
                      value={requirement.category || 'content'}
                      onChange={(e) => handleRequirementChange(index, 'category', e.target.value)}
                    >
                      <option value="content">Content</option>
                      <option value="access">Access</option>
                      <option value="assets">Assets</option>
                      <option value="documentation">Documentation</option>
                      <option value="credentials">Credentials</option>
                      <option value="other">Other</option>
                    </Select>
                    <CategoryBadge category={requirement.category}>
                      {requirement.category || 'content'}
                    </CategoryBadge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#6c757d' }}>Priority:</label>
                    <Select
                      value={requirement.priority || 'medium'}
                      onChange={(e) => handleRequirementChange(index, 'priority', e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                    <PriorityBadge priority={requirement.priority}>
                      {requirement.priority || 'medium'}
                    </PriorityBadge>
                  </div>

                  <CheckboxLabel>
                    <input
                      type="checkbox"
                      checked={requirement.is_required !== false}
                      onChange={(e) => handleRequirementChange(index, 'is_required', e.target.checked)}
                    />
                    <span>Required</span>
                  </CheckboxLabel>
                </MetaRow>
              </RequirementCard>
            ))}
          </RequirementsList>

          <AddButton onClick={addRequirement}>
            + Add Requirement
          </AddButton>
        </>
    </Container>
  );
};

RequiredFromCustomer.propTypes = {
  proposalId: PropTypes.string,
  onChange: PropTypes.func
};

export default RequiredFromCustomer;
