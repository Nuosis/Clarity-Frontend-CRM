import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { createProposalRequest, updateProposalRequest, deleteProposalRequest } from '../../api/proposalExtended';

const Container = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: 8px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const Description = styled.p`
  margin: 0 0 16px 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 14px;
  line-height: 1.5;
`;

const RequestList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
`;

const RequestItem = styled.div`
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const RequestNumber = styled.div`
  min-width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.theme.colors.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
`;

const RequestContent = styled.div`
  flex: 1;
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

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primaryLight};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.tertiary};
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

/**
 * RequestsTab Component
 * Documents client asks and feature requests for the proposal
 * Backend team is developing the API for this (requests table)
 *
 * @param {Object} props - Component props
 * @param {Array} props.requests - Array of request objects
 * @param {Function} props.onChange - Callback when requests change
 * @param {string} props.proposalId - Proposal ID (required for database operations)
 */
const RequestsTab = ({ requests = [], onChange, proposalId }) => {
  const [saving, setSaving] = useState(false);

  const handleRequestChange = useCallback(async (index, value) => {
    const request = requests[index];
    const newRequests = [...requests];
    newRequests[index] = { ...newRequests[index], text: value };
    onChange(newRequests);

    // Auto-save to database after user stops typing (debounced via timeout)
    if (request.dbId && proposalId) {
      // Update existing request in database - send description field to API
      setTimeout(async () => {
        const result = await updateProposalRequest(request.dbId, { description: value });
        if (!result.success) {
          console.error('[RequestsTab] Failed to update request:', result.error);
        }
      }, 1000); // 1 second debounce
    }
  }, [requests, onChange, proposalId]);

  const addRequest = useCallback(async () => {
    if (!proposalId) {
      // If no proposalId yet (creating new proposal), just add to local state
      onChange([...requests, { id: crypto.randomUUID(), text: '' }]);
      return;
    }

    setSaving(true);
    try {
      // Create request in database immediately
      const requestData = {
        proposal_id: proposalId,
        title: 'New Request', // API requires title field
        description: '', // Use description for the actual content
        status: 'pending'
      };

      const result = await createProposalRequest(requestData);

      if (result.success) {
        // Add to local state with database ID
        const newRequest = {
          id: crypto.randomUUID(), // Local temp ID for React key
          dbId: result.data.id, // Database ID for updates
          text: result.data.description || '', // Map description to text for UI
          title: result.data.title,
          status: result.data.status
        };
        onChange([...requests, newRequest]);
      } else {
        console.error('[RequestsTab] Failed to create request:', result.error);
        alert('Failed to create request. Please try again.');
      }
    } catch (error) {
      console.error('[RequestsTab] Error creating request:', error);
      alert('Error creating request. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [requests, onChange, proposalId]);

  const removeRequest = useCallback(async (index) => {
    const request = requests[index];

    // Remove from local state immediately
    const newRequests = requests.filter((_, i) => i !== index);
    onChange(newRequests);

    // Delete from database if it has a database ID
    if (request.dbId && proposalId) {
      const result = await deleteProposalRequest(request.dbId);
      if (!result.success) {
        console.error('[RequestsTab] Failed to delete request:', result.error);
        // Optionally: revert the local state change if delete fails
      }
    }
  }, [requests, onChange, proposalId]);

  return (
    <Container>
      <Header>
        <div>
          <Title>Client Requests</Title>
          <Description>
            Document specific asks, features, and requirements mentioned by the client.
            These help clarify the project scope and ensure nothing is overlooked.
          </Description>
        </div>
      </Header>


      <RequestList>
        {requests.map((request, index) => (
          <RequestItem key={request.id || index}>
            <RequestNumber>{index + 1}</RequestNumber>
            <RequestContent>
              <TextArea
                value={request.text || ''}
                onChange={(e) => handleRequestChange(index, e.target.value)}
                placeholder="Describe the client's request or requirement..."
                rows={2}
              />
            </RequestContent>
            <RemoveButton
              onClick={() => removeRequest(index)}
              title="Remove request"
            >
              ×
            </RemoveButton>
          </RequestItem>
        ))}
      </RequestList>

      <AddButton onClick={addRequest} disabled={saving}>
        {saving ? 'Adding...' : '+ Add Request'}
      </AddButton>
    </Container>
  );
};

RequestsTab.propTypes = {
  requests: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      dbId: PropTypes.string,
      text: PropTypes.string,
      status: PropTypes.string
    })
  ),
  onChange: PropTypes.func.isRequired,
  proposalId: PropTypes.string
};

export default RequestsTab;
