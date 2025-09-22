import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useLink } from '../../hooks/useLink';
import { useProject } from '../../hooks/useProject';
import TextInput from '../global/TextInput';
import { parseGitHubUrl } from '../../utils/githubUtils';
import { checkRepositoryExists, createRepository, getRepositoryInfo } from '../../api/github';
import GitHubRepositoryModal from './GitHubRepositoryModal';

// Memoized resource grid component
const ResourceGrid = React.memo(function ResourceGrid({
  title,
  items,
  renderItem,
  darkMode,
  emptyMessage
}) {
  if (!items?.length) {
    return (
      <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <div className="grid grid-cols-2 gap-4">
        {items.map(renderItem)}
      </div>
    </div>
  );
});

ResourceGrid.propTypes = {
  title: PropTypes.string,
  items: PropTypes.array,
  renderItem: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired,
  emptyMessage: PropTypes.string.isRequired
};

function ProjectLinksTab({ project, darkMode, localProject, setLocalProject }) {
  const [showNewLinkInput, setShowNewLinkInput] = useState(false);
  const { handleLinkCreate, loading: linkLoading } = useLink();
  const { loadProjectDetails } = useProject();
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [ghPrefill, setGhPrefill] = useState({ owner: '', repo: '', description: '', visibility: 'private' });
  const [pendingUrl, setPendingUrl] = useState('');
  const [ghMeta, setGhMeta] = useState({}); // key 'owner/repo' → { data, loading, error }

  // Fetch GitHub metadata for visible links once per repo
  useEffect(() => {
    const links = (localProject?.links || project?.links) || [];
    const toFetch = [];

    links.forEach((link) => {
      const gh = parseGitHubUrl(link.url);
      if (gh?.isGitHub && gh.owner && gh.repo) {
        const key = `${gh.owner}/${gh.repo}`;
        if (!ghMeta[key]) {
          toFetch.push({ owner: gh.owner, repo: gh.repo, key });
        }
      }
    });

    if (toFetch.length === 0) return;

    // mark pending as loading
    setGhMeta((prev) => {
      const next = { ...prev };
      toFetch.forEach(({ key }) => {
        if (!next[key]) {
          next[key] = { data: null, loading: true, error: null };
        }
      });
      return next;
    });

    let cancelled = false;

    (async () => {
      for (const { owner, repo, key } of toFetch) {
        try {
          const resp = await getRepositoryInfo({ owner, repo });
          const info = resp?.data ?? resp ?? {};
          if (cancelled) return;
          setGhMeta((prev) => ({ ...prev, [key]: { data: info, loading: false, error: null } }));
        } catch (err) {
          if (cancelled) return;
          setGhMeta((prev) => ({ ...prev, [key]: { data: null, loading: false, error: err } }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [localProject?.links, project?.links, ghMeta]);

  // Memoized renderers
  const renderLink = useCallback((link) => {
    return (
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`
          block p-2 rounded
          ${darkMode
            ? 'text-blue-400 hover:bg-gray-800'
            : 'text-blue-600 hover:bg-gray-100'}
        `}
      >
        <span>{link.title || link.url}</span>
      </a>
    );
  }, [darkMode]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Links</h3>
        <button
          onClick={() => setShowNewLinkInput(true)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
          disabled={linkLoading}
        >
          {linkLoading ? 'Adding...' : 'New Link'}
        </button>
      </div>
      {showNewLinkInput && (
        <div className="mb-4">
          <TextInput
            title="Add Link"
            placeholder="Enter URL..."
            submitLabel="Create"
            onSubmit={async (url) => {
              try {
                const trimmed = url.trim();

                // GitHub repo URL pre-check: open modal if it doesn't exist
                const parsed = parseGitHubUrl(trimmed);
                if (parsed?.isGitHub && parsed.owner && parsed.repo) {
                  try {
                    setPendingUrl(trimmed);
                    const chk = await checkRepositoryExists({ owner: parsed.owner, repo: parsed.repo });
                    const exists = chk?.exists ?? chk?.data?.exists;
                    if (!exists) {
                      setGhPrefill({ owner: parsed.owner, repo: parsed.repo, description: '', visibility: 'private' });
                      setRepoModalOpen(true);
                      return;
                    }
                  } catch (e) {
                    // Fallback: proceed with existing flow on check failure
                    console.error('GitHub repo existence check failed:', e);
                  }
                }

                // Create a temporary link object with a temporary ID
                const tempLink = {
                  id: `temp-${Date.now()}`,
                  url: trimmed,
                  title: new URL(trimmed).hostname
                };
                
                // Optimistically update the UI by adding the new link to the local project state
                const updatedProject = {
                  ...localProject || project,
                  links: [...(localProject?.links || project?.links || []), tempLink]
                };
                setLocalProject(updatedProject);
                
                // Hide the input form
                setShowNewLinkInput(false);
                
                // Make the actual API call
                const result = await handleLinkCreate(project.__ID, trimmed);
                
                if (result) {
                  // On success, refresh the project details to get the actual link data
                  await loadProjectDetails(project.__ID);
                } else {
                  // If the API call failed, revert the optimistic update
                  const revertedLinks = (localProject?.links || project?.links || [])
                    .filter(link => link.id !== tempLink.id);
                  
                  setLocalProject({
                    ...localProject || project,
                    links: revertedLinks
                  });
                }
              } catch (error) {
                console.error('Error creating link:', error);
                
                // If there's an error, revert the optimistic update
                if (localProject?.links) {
                  const revertedLinks = localProject.links
                    .filter(link => !link.id.startsWith('temp-'));
                  
                  setLocalProject({
                    ...localProject,
                    links: revertedLinks
                  });
                }
              }
            }}
            onCancel={() => setShowNewLinkInput(false)}
          />
        </div>
      )}
      {(localProject?.links || project?.links)?.length > 0 ? (
        <ResourceGrid
          items={localProject?.links || project?.links}
          renderItem={renderLink}
          darkMode={darkMode}
          emptyMessage="No links added yet"
        />
      ) : (
        <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No links added yet
        </div>
      )}

      <GitHubRepositoryModal
        key={pendingUrl}
        isOpen={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        onCreate={async ({ owner, repo, description, visibility }) => {
          try {
            await createRepository({ owner, repo, description, visibility });
            const normalized = `https://github.com/${owner}/${repo}`;
            const result = await handleLinkCreate(project.__ID, normalized);
            if (result) {
              await loadProjectDetails(project.__ID);
            }
            setRepoModalOpen(false);
            setPendingUrl('');
          } catch (err) {
            console.error('Error creating GitHub repository:', err);
            // Reopen modal (it closes itself onCreate); preserves UX expectation to keep open on error
            setRepoModalOpen(true);
          }
        }}
        initialOwner={ghPrefill.owner}
        initialRepo={ghPrefill.repo}
        initialDescription={ghPrefill.description || ''}
        initialVisibility={ghPrefill.visibility}
      />
    </div>
  );
}

ProjectLinksTab.propTypes = {
  project: PropTypes.shape({
    __ID: PropTypes.string.isRequired,
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      title: PropTypes.string
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.object,
  setLocalProject: PropTypes.func.isRequired
};

export default React.memo(ProjectLinksTab);