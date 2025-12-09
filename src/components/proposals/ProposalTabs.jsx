import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import RequestsTab from './RequestsTab';
import ConceptGallery from './ConceptGallery';
import DeliverablesTab from './DeliverablesTab';
import RequiredFromCustomer from './RequiredFromCustomer';
import SummaryTab from './SummaryTab';
import { fetchProposalDeliverables } from '../../api/proposalExtended';

const Container = styled.div`
  width: 100%;
`;

const TabsContainer = styled.div`
  border-bottom: 2px solid ${props => props.theme.colors.border};
  margin-bottom: 24px;
`;

const TabsList = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
`;

const Tab = styled.button.attrs(props => ({
  // Filter out non-DOM props to prevent React warnings
  isActive: undefined,
  hasContent: undefined
}))`
  background: ${props => props.$isActive
    ? props.theme?.colors?.background?.primary || '#ffffff'
    : 'transparent'};
  color: ${props => props.$isActive
    ? props.theme?.colors?.primary || '#007bff'
    : props.theme.colors.text.secondary};
  border: none;
  border-bottom: 3px solid ${props => props.$isActive
    ? props.theme?.colors?.primary || '#007bff'
    : 'transparent'};
  padding: 12px 20px;
  font-size: 15px;
  font-weight: ${props => props.$isActive ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  white-space: nowrap;

  &:hover {
    color: ${props => props.theme.colors.primary};
    background: ${props => props.theme.colors.background.secondary};
  }

  ${props => props.$hasContent && !props.$isActive && `
    &:after {
      content: '•';
      position: absolute;
      top: 8px;
      right: 8px;
      color: ${props.theme.colors.success};
      font-size: 20px;
    }
  `}
`;

const TabPanel = styled.div.attrs(props => ({
  // Filter out non-DOM props
  isActive: undefined
}))`
  display: ${props => props.$isActive ? 'block' : 'none'};
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Badge = styled.span`
  background: ${props => props.theme.colors.primary};
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 6px;
`;

/**
 * ProposalTabs Component
 * Tabbed interface for managing all aspects of a proposal
 *
 * @param {Object} props - Component props
 * @param {Array} props.requests - Client requests
 * @param {Array} props.concepts - Concepts and assets
 * @param {Array} props.deliverables - Deliverables
 * @param {Array} props.requirements - Requirements from customer
 * @param {Array} props.packages - Proposal packages
 * @param {Function} props.onRequestsChange - Callback for requests changes
 * @param {Function} props.onConceptsChange - Callback for concepts changes
 * @param {Function} props.onDeliverablesChange - Callback for deliverables changes
 * @param {Function} props.onRequirementsChange - Callback for requirements changes
 * @param {Function} props.onPackagesChange - Callback for packages changes
 * @param {Function} props.onConceptUpload - Optional callback for concept file uploads
 * @param {string} props.defaultTab - Default active tab
 */
const ProposalTabs = ({
  requests = [],
  concepts = [],
  deliverables = [],
  requirements = [],
  packages = [],
  onRequestsChange,
  onConceptsChange,
  onDeliverablesChange,
  onRequirementsChange,
  onPackagesChange,
  onConceptUpload,
  repositoryConfig,
  darkMode,
  defaultTab = 'requests',
  proposalId
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [deliverablesLoaded, setDeliverablesLoaded] = useState(false);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  // Load deliverables immediately when proposal loads (not lazy-loaded)
  useEffect(() => {
    const loadDeliverables = async () => {
      if (proposalId && !deliverablesLoaded && !loadingDeliverables) {
        console.log('[ProposalTabs] Loading deliverables for proposal:', proposalId);
        setLoadingDeliverables(true);

        try {
          const result = await fetchProposalDeliverables(proposalId);
          console.log('[ProposalTabs] Deliverables loaded:', result);

          if (result.success && result.data) {
            // Map API response to component format and sort by sort_order (ASC)
            const mappedDeliverables = result.data
              .map(deliverable => ({
                id: deliverable.id || crypto.randomUUID(),
                dbId: deliverable.id,
                title: deliverable.title || '',
                description: deliverable.description || '',
                price: parseFloat(deliverable.price) || 0,
                type: deliverable.type || 'fixed',
                estimated_time: parseInt(deliverable.estimated_time) || 0,
                billing_interval: deliverable.billing_interval || 'monthly',
                subscription_duration_months: deliverable.subscription_duration_months ? parseInt(deliverable.subscription_duration_months) : null,
                is_required: deliverable.is_required || false,
                order: deliverable.sort_order || 0
              }))
              .sort((a, b) => a.order - b.order); // Sort by order (ASC)

            console.log('[ProposalTabs] Mapped and sorted deliverables:', mappedDeliverables);
            onDeliverablesChange(mappedDeliverables);
            setDeliverablesLoaded(true);
          }
        } catch (error) {
          console.error('[ProposalTabs] Error loading deliverables:', error);
        } finally {
          setLoadingDeliverables(false);
        }
      }
    };

    loadDeliverables();
  }, [proposalId, deliverablesLoaded, loadingDeliverables, onDeliverablesChange]);

  const tabs = [
    {
      id: 'requests',
      label: 'Requests',
      count: requests.length,
      hasContent: requests.length > 0
    },
    {
      id: 'concepts',
      label: 'Concepts & Assets',
      count: concepts.length,
      hasContent: concepts.length > 0
    },
    {
      id: 'deliverables',
      label: 'Deliverables',
      count: deliverables.length,
      hasContent: deliverables.length > 0
    },
    {
      id: 'requirements',
      label: 'Required From Customer',
      count: requirements.length,
      hasContent: requirements.length > 0
    },
    {
      id: 'summary',
      label: 'Summary',
      count: packages.length,
      hasContent: packages.length > 0
    }
  ];

  return (
    <Container>
      <TabsContainer>
        <TabsList>
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              $isActive={activeTab === tab.id}
              $hasContent={tab.hasContent}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <Badge>{tab.count}</Badge>}
            </Tab>
          ))}
        </TabsList>
      </TabsContainer>

      <TabPanel $isActive={activeTab === 'requests'}>
        <RequestsTab
          requests={requests}
          onChange={onRequestsChange}
          proposalId={proposalId}
        />
      </TabPanel>

      <TabPanel $isActive={activeTab === 'concepts'}>
        <ConceptGallery
          concepts={concepts}
          onConceptsChange={onConceptsChange}
          onConceptUpload={onConceptUpload}
          repositoryConfig={repositoryConfig}
          darkMode={darkMode}
          isEditable={true}
        />
      </TabPanel>

      <TabPanel $isActive={activeTab === 'deliverables'}>
        <DeliverablesTab
          deliverables={deliverables}
          onChange={onDeliverablesChange}
          proposalId={proposalId}
        />
      </TabPanel>

      <TabPanel $isActive={activeTab === 'requirements'}>
        <RequiredFromCustomer
          proposalId={proposalId}
          onChange={onRequirementsChange}
        />
      </TabPanel>

      <TabPanel $isActive={activeTab === 'summary'}>
        <SummaryTab
          proposalId={proposalId}
          packages={packages}
          deliverables={deliverables}
          requirements={requirements}
          onChange={onPackagesChange}
        />
      </TabPanel>
    </Container>
  );
};

ProposalTabs.propTypes = {
  requests: PropTypes.array,
  concepts: PropTypes.array,
  deliverables: PropTypes.array,
  requirements: PropTypes.array,
  packages: PropTypes.array,
  onRequestsChange: PropTypes.func.isRequired,
  onConceptsChange: PropTypes.func.isRequired,
  onDeliverablesChange: PropTypes.func.isRequired,
  onRequirementsChange: PropTypes.func.isRequired,
  onPackagesChange: PropTypes.func.isRequired,
  onConceptUpload: PropTypes.func,
  repositoryConfig: PropTypes.shape({
    owner: PropTypes.string.isRequired,
    repo: PropTypes.string.isRequired
  }),
  darkMode: PropTypes.bool,
  defaultTab: PropTypes.string,
  proposalId: PropTypes.string
};

export default ProposalTabs;
