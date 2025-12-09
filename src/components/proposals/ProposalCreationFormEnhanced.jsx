import { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { createProposal, selectProposalCreating, selectProposalError } from '../../store/slices/proposalSlice';
import ProposalTabs from './ProposalTabs';
import styled from 'styled-components';
import { useAppState } from '../../context/AppStateContext';
import { fetchProposalRequests } from '../../api/proposalExtended';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: ${props => props.theme.colors.background.primary};
  border-radius: ${props => props.theme.radius.lg};
  box-shadow: ${props => props.theme.shadows.md};
`;

const Header = styled.div`
  margin-bottom: 32px;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  border: none;
  font-size: 24px;
  color: ${props => props.theme.colors.text.tertiary};
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  transition: ${props => props.theme.transitions.base};
  border-radius: ${props => props.theme.radius.sm};

  &:hover {
    color: ${props => props.theme.colors.text.primary};
    background: ${props => props.theme.colors.background.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const Title = styled.h2`
  margin: 0 0 12px 0;
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text.primary};
  padding-right: 40px;
`;

const ProjectInfo = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: ${props => props.theme.radius.md};
  padding: 16px;
  margin-bottom: 24px;
`;

const ProjectName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 4px;
`;

const ProjectDetails = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.text.secondary};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const BasicInfoSection = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border-radius: ${props => props.theme.radius.lg};
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  padding-bottom: 12px;
  border-bottom: 2px solid ${props => props.theme.colors.border};
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radius.md};
  font-size: 14px;
  margin-bottom: 16px;
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};

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
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radius.md};
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 16px;
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primaryLight};
  }

  &::placeholder {
    color: ${props => props.theme.colors.text.tertiary};
  }
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 6px;
`;

const Required = styled.span`
  color: ${props => props.theme.colors.danger};
`;

const ErrorMessage = styled.div`
  background: ${props => props.theme.colors.danger}15;
  border: 1px solid ${props => props.theme.colors.danger};
  border-radius: ${props => props.theme.radius.md};
  padding: 12px 16px;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.danger};
  font-size: 14px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 2px solid ${props => props.theme.colors.border};
  margin-top: 32px;
`;

const TotalDisplay = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.text.secondary};

  strong {
    font-size: 24px;
    font-weight: 700;
    color: ${props => props.theme.colors.primary};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const SubmitButton = styled.button`
  background: ${props => props.theme.colors.primary};
  color: ${props => props.theme.colors.text.inverse};
  border: none;
  border-radius: ${props => props.theme.radius.md};
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: ${props => props.theme.transitions.base};

  &:hover:not(:disabled) {
    background: ${props => props.theme.colors.primaryDark};
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.lg};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  background: transparent;
  color: ${props => props.theme.colors.text.secondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.radius.md};
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: ${props => props.theme.transitions.base};

  &:hover {
    background: ${props => props.theme.colors.background.secondary};
    border-color: ${props => props.theme.colors.text.secondary};
  }
`;

/**
 * Enhanced Proposal Creation Form Component
 * Complete proposal management with tabs for requests, concepts, deliverables, requirements, and summary
 *
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {Object} props.proposal - Optional existing proposal for editing
 * @param {Object} props.repositoryConfig - Optional GitHub repository configuration
 * @param {boolean} props.darkMode - Optional dark mode flag
 * @param {Function} props.onProposalCreate - Callback when proposal is created
 * @param {Function} props.onCancel - Optional callback for cancel action
 */
const ProposalCreationFormEnhanced = ({ project, proposal, repositoryConfig, darkMode, onProposalCreate, onCancel }) => {
  console.log('[ProposalCreationFormEnhanced] Rendering with proposal:', proposal, 'proposal?.id:', proposal?.id);
  const dispatch = useDispatch();
  const creating = useSelector(selectProposalCreating);
  const error = useSelector(selectProposalError);
  const { customers } = useAppState();

  // Determine if we're editing an existing proposal
  const isEditing = !!proposal;

  // Look up customer name from customers list
  const customerName = useMemo(() => {
    const customerId = project._custID || project.customer_id;
    if (!customerId || !customers || customers.length === 0) {
      return customerId; // Fallback to ID if we can't find the customer
    }
    const customer = customers.find(c => c.id === customerId);
    return customer?.Name || customer?.business_name || customerId;
  }, [project._custID, project.customer_id, customers]);

  const [formData, setFormData] = useState({
    title: proposal?.title || '',
    description: proposal?.description || ''
  });

  // Tab content states - initialize from proposal if editing
  const [requests, setRequests] = useState(proposal?.requests || []);
  const [concepts, setConcepts] = useState(proposal?.concepts || []);
  const [deliverables, setDeliverables] = useState(proposal?.deliverables || []);
  const [requirements, setRequirements] = useState(proposal?.requirements || []);
  const [packages, setPackages] = useState(proposal?.packages || []);

  // Update form data when proposal prop changes
  useEffect(() => {
    const loadProposalData = async () => {
      console.log('[ProposalForm] loadProposalData called with proposal:', proposal);
      if (proposal) {
        setFormData({
          title: proposal.title || '',
          description: proposal.description || ''
        });

        // Load requests from database if editing
        if (proposal.id) {
          console.log('[ProposalForm] Loading data for proposal ID:', proposal.id);

          const requestsResult = await fetchProposalRequests(proposal.id);
          console.log('[ProposalForm] Requests result:', requestsResult);
          if (requestsResult.success && requestsResult.data) {
            // Map API response fields to component expected format
            const mappedRequests = requestsResult.data.map(request => ({
              id: request.id || crypto.randomUUID(),
              dbId: request.id,
              text: request.description || '',
              title: request.title,
              status: request.status
            }));
            console.log('[ProposalForm] Setting requests:', mappedRequests);
            setRequests(mappedRequests);
          } else {
            setRequests(proposal.requests || []);
          }

          // Deliverables are now lazy-loaded in ProposalTabs when clicking the tab
          // Don't load them here to avoid unnecessary API calls
        } else {
          console.log('[ProposalForm] No proposal.id, using proposal prop data');
          setRequests(proposal.requests || []);
          setDeliverables(proposal.deliverables || []);
        }

        setConcepts(proposal.concepts || []);
        setRequirements(proposal.requirements || []);
        setPackages(proposal.packages || []);
      }
    };

    loadProposalData();
  }, [proposal]);

  const totalPrice = useMemo(() => {
    return deliverables.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);
  }, [deliverables]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleConceptUpload = useCallback((event) => {
    const files = Array.from(event.target.files);

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newConcept = {
          id: crypto.randomUUID(),
          title: file.name,
          description: '',
          type: file.type.startsWith('image/') ? 'mockup' : 'document',
          url: e.target.result,
          thumbnailUrl: e.target.result,
          order: concepts.length + index
        };

        setConcepts(prev => [...prev, newConcept]);
      };
      reader.readAsDataURL(file);
    });
  }, [concepts.length]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a proposal title');
      return;
    }

    const proposalData = {
      ...formData,
      id: proposal?.id, // Include ID when editing to update existing proposal
      projectId: project.id,
      customerId: project._custID || project.customer_id,
      requests,
      concepts: concepts.map((c, index) => ({ ...c, order: index })),
      deliverables: deliverables.map((d, index) => ({ ...d, order: index })),
      requirements,
      packages,
      totalPrice,
      selectedPrice: totalPrice // Initially all deliverables are selected
    };

    console.log('[ProposalForm] Submitting proposal:', proposalData);

    try {
      const result = await dispatch(createProposal(proposalData));
      console.log('[ProposalForm] Create result:', result);

      if (result.type === 'proposals/createProposal/fulfilled') {
        console.log('[ProposalForm] Proposal created successfully:', result.payload);
        const createdProposal = result.payload;

        // Note: Requests are now saved immediately when added via RequestsTab
        // No need to batch save them here anymore

        onProposalCreate?.(createdProposal);
      } else if (result.type === 'proposals/createProposal/rejected') {
        console.error('[ProposalForm] Proposal creation rejected:', result.error || result.payload);
        alert(`Failed to create proposal: ${result.error?.message || result.payload || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[ProposalForm] Failed to create proposal:', error);
      alert(`Error creating proposal: ${error.message}`);
    }
  }, [dispatch, formData, project, proposal, requests, concepts, deliverables, requirements, packages, totalPrice, onProposalCreate, isEditing]);

  return (
    <Container>
      <Header>
        {onCancel && (
          <CloseButton
            type="button"
            onClick={onCancel}
            aria-label="Close"
            title="Close"
          >
            ×
          </CloseButton>
        )}
        <Title>{isEditing ? 'Update Proposal' : 'Create New Proposal'}</Title>

        <ProjectInfo>
          <ProjectName>{project.Name || project.name}</ProjectName>
          <ProjectDetails>
            Status: {project.status || 'Active'}
          </ProjectDetails>
        </ProjectInfo>
      </Header>

      {error && (
        <ErrorMessage>
          Error: {error}
        </ErrorMessage>
      )}

      <Form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <BasicInfoSection>
          <SectionTitle>Basic Information</SectionTitle>

          <div>
            <Label>
              Proposal Title <Required>*</Required>
            </Label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter a descriptive title for this proposal"
              required
            />
          </div>

          <div>
            <Label>Description</Label>
            <TextArea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Provide a brief description of what this proposal covers..."
            />
          </div>
        </BasicInfoSection>

        {/* Tabbed Content */}
        <ProposalTabs
          requests={requests}
          concepts={concepts}
          deliverables={deliverables}
          requirements={requirements}
          packages={packages}
          onRequestsChange={setRequests}
          onConceptsChange={setConcepts}
          onDeliverablesChange={setDeliverables}
          onRequirementsChange={setRequirements}
          onPackagesChange={setPackages}
          onConceptUpload={handleConceptUpload}
          repositoryConfig={repositoryConfig}
          darkMode={darkMode}
          defaultTab="requests"
          proposalId={proposal?.id}
        />

        {/* Footer with Submit */}
        <Footer>
          <TotalDisplay>
            Deliverables Total: <strong>${totalPrice.toFixed(2)}</strong>
            {packages.length > 0 && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {packages.length} package{packages.length !== 1 ? 's' : ''} created
              </div>
            )}
          </TotalDisplay>

          <ButtonGroup>
            {onCancel && (
              <CancelButton type="button" onClick={onCancel}>
                Cancel
              </CancelButton>
            )}
            <SubmitButton type="submit" disabled={creating}>
              {creating
                ? (isEditing ? 'Updating...' : 'Creating...')
                : (isEditing ? 'Update Proposal' : 'Create Proposal')
              }
            </SubmitButton>
          </ButtonGroup>
        </Footer>
      </Form>
    </Container>
  );
};

ProposalCreationFormEnhanced.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string,
    Name: PropTypes.string,
    name: PropTypes.string,
    _custID: PropTypes.string,
    customer_id: PropTypes.string,
    status: PropTypes.string
  }).isRequired,
  proposal: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string
  }),
  repositoryConfig: PropTypes.shape({
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired
  }),
  darkMode: PropTypes.bool,
  onProposalCreate: PropTypes.func,
  onCancel: PropTypes.func
};

export default ProposalCreationFormEnhanced;
