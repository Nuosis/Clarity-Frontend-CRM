import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { fetchProposalsForProject } from '../../api/proposals';
import { processProposalData, validateProposalData, createCompleteProposal } from '../../services/proposalService';
import { parseGitHubUrl } from '../../utils/githubUtils';
import ProposalCreationFormEnhanced from './ProposalCreationFormEnhanced';

/**
 * ProposalCard component - displays a proposal as a card similar to ProjectCard
 * @param {Object} props - Component props
 * @param {Object} props.proposal - Proposal data
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Function} props.onSelect - Callback when card is clicked
 * @param {Function} props.onViewClientLink - Callback to view client link
 */
function ProposalCard({ proposal, darkMode, onSelect, onViewClientLink }) {
  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
      case 'sent':
        return darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800';
      case 'draft':
        return darkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
      default:
        return darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800';
    }
  };

  const statusColor = getStatusColor(proposal.status);

  return (
    <div
      className={`
        p-4 rounded-lg border cursor-pointer transition-colors duration-150
        ${darkMode
          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-gray-300'}
      `}
    >
      <div onClick={() => onSelect(proposal)}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-lg truncate">{proposal.title}</h3>
          <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${statusColor}`}>
            {proposal.status || 'Draft'}
          </span>
        </div>

        {proposal.description && (
          <p className={`text-sm mb-3 line-clamp-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {proposal.description}
          </p>
        )}

        <div className="space-y-2">
          {proposal.created_at && (
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Created: {new Date(proposal.created_at).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-700">
            <div>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Price
              </p>
              <p className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                ${(proposal.total_price || 0).toLocaleString()}
              </p>
            </div>
            {proposal.selected_price !== proposal.total_price && (
              <div className="text-right">
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Selected
                </p>
                <p className={`text-sm font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  ${(proposal.selected_price || 0).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {proposal.access_token && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewClientLink(proposal);
            }}
            className={`
              w-full px-3 py-2 text-sm rounded-md transition-colors
              ${darkMode
                ? 'bg-blue-700 hover:bg-blue-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'}
            `}
          >
            View Client Link
          </button>
        </div>
      )}
    </div>
  );
}

ProposalCard.propTypes = {
  proposal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    status: PropTypes.string,
    created_at: PropTypes.string,
    total_price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    selected_price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    access_token: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  onViewClientLink: PropTypes.func.isRequired
};

/**
 * Project Proposal Tab component - manages multiple proposals per project
 * @param {Object} props - Component props
 * @param {Object} props.project - Project data
 * @param {boolean} props.darkMode - Dark mode flag
 * @param {Object} props.localProject - Local project state
 * @param {Function} props.setLocalProject - Local project state setter
 */
function ProjectProposalsTab({ project, darkMode, localProject}) {
  const dispatch = useDispatch();
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get GitHub repository info from project links
  const repositoryConfig = useMemo(() => {
    const links = (localProject?.links || project?.links) || [];
    const githubLink = links.find(link => {
      const parsed = parseGitHubUrl(link.url);
      return parsed?.isGitHub;
    });

    if (!githubLink) return null;

    const parsed = parseGitHubUrl(githubLink.url);
    return parsed?.isGitHub ? { owner: parsed.owner, repo: parsed.repo } : null;
  }, [localProject?.links, project?.links]);

  // Load existing proposals for the project
  useEffect(() => {
    const loadProposals = async () => {
      if (!project?.id) return;

      setLoading(true);
      try {
        const result = await fetchProposalsForProject(project.id);
        if (result.success && result.data.length > 0) {
          // Process all proposals
          const processedProposals = result.data.map(processProposalData);
          setProposals(processedProposals);
        } else {
          setProposals([]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProposals();
  }, [project?.id]);

  const handleSelectProposal = useCallback((proposal) => {
    setSelectedProposal(proposal);
    setIsEditing(true);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setSelectedProposal(null);
    setError(null);
  }, []);

  const handleCreate = useCallback(() => {
    setIsEditing(true);
    setSelectedProposal(null);
    setError(null);
  }, []);

  const handleViewClientLink = useCallback((proposal) => {
    if (!proposal?.access_token) {
      setError('No client access token available for this proposal');
      return;
    }

    // Generate the client view URL
    const clientUrl = `${window.location.origin}/proposal/view/${proposal.access_token}`;

    // Open in new window
    window.open(clientUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Loading proposal...</p>
        </div>
      </div>
    );
  }

  // Show proposal form when editing or creating
  if (isEditing) {
    return (
      <div>
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <ProposalCreationFormEnhanced
          project={project}
          proposal={selectedProposal}
          repositoryConfig={repositoryConfig}
          darkMode={darkMode}
          onProposalCreate={(createdProposal) => {
            // Add the new proposal to the list or update existing
            setProposals(prev => {
              const existingIndex = prev.findIndex(p => p.id === createdProposal.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = createdProposal;
                return updated;
              }
              return [createdProposal, ...prev];
            });
            setIsEditing(false);
            setSelectedProposal(null);
          }}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  // Show list of proposals
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Proposals</h3>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
        >
          Create New Proposal
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Proposals Grid */}
      {proposals.length === 0 ? (
        <div className="text-center py-12">
          <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No proposals yet for this project
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
          >
            Create First Proposal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              darkMode={darkMode}
              onSelect={handleSelectProposal}
              onViewClientLink={handleViewClientLink}
            />
          ))}
        </div>
      )}
    </div>
  );
}

ProjectProposalsTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    _custID: PropTypes.string.isRequired,
    title: PropTypes.string
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.object,
  setLocalProject: PropTypes.func.isRequired
};

export default ProjectProposalsTab;