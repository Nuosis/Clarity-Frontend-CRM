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
  const { handleLinkCreate, handleLinkUpdate, handleLinkDelete, loading: linkLoading } = useLink();
  const { loadProjectDetails } = useProject();
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [ghPrefill, setGhPrefill] = useState({ owner: '', repo: '', description: '', visibility: 'private' });
  const [pendingUrl, setPendingUrl] = useState('');
  const [ghMeta, setGhMeta] = useState({}); // key 'owner/repo' → { data, loading, error }
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingUrl, setEditingUrl] = useState('');

  // Get project ID - support both backend (id) and FileMaker (__ID) formats
  const projectId = project?.id || project?.__ID;

  // Fetch GitHub metadata for visible links once per repo
  useEffect(() => {
    const links = (localProject?.links || project?.links) || [];
    const toFetch = [];

    links.forEach((link) => {
      // Support both backend (url) and any legacy (link) field names
      const linkUrl = link.url || link.link;
      const gh = parseGitHubUrl(linkUrl);
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
  }, [localProject?.links, project?.links]);

  // Memoized renderers
  const renderLink = useCallback((link) => {
    // Support both backend (url) and any legacy (link) field names
    const linkUrl = link.url || link.link;
    const linkTitle = link.title || linkUrl;
    const isEditing = editingLinkId === link.id;

    if (isEditing) {
      return (
        <div key={link.id} className={`
          p-2 rounded border
          ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}
        `}>
          <input
            type="text"
            value={editingUrl}
            onChange={(e) => setEditingUrl(e.target.value)}
            className={`
              w-full px-2 py-1 text-sm rounded border mb-2
              ${darkMode
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300 text-gray-900'}
            `}
            placeholder="Enter URL..."
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const result = await handleLinkUpdate(link.id, { url: editingUrl.trim() });
                  if (result) {
                    await loadProjectDetails(projectId);
                    setEditingLinkId(null);
                    setEditingUrl('');
                  }
                } catch (error) {
                  console.error('Error updating link:', error);
                }
              }}
              disabled={!editingUrl.trim() || linkLoading}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingLinkId(null);
                setEditingUrl('');
              }}
              className={`
                px-3 py-1 text-sm rounded
                ${darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
              `}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={link.id}
        className={`
          flex items-center justify-between p-2 rounded group
          ${darkMode
            ? 'hover:bg-gray-800'
            : 'hover:bg-gray-100'}
        `}
      >
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            flex-1 truncate
            ${darkMode ? 'text-blue-400' : 'text-blue-600'}
          `}
        >
          {linkTitle}
        </a>
        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              setEditingLinkId(link.id);
              setEditingUrl(linkUrl);
            }}
            className={`
              px-2 py-1 text-xs rounded
              ${darkMode
                ? 'text-blue-400 hover:bg-gray-700'
                : 'text-blue-600 hover:bg-blue-50'}
            `}
            data-testid={`edit-link-${link.id}`}
          >
            Edit
          </button>
          <button
            onClick={async () => {
              if (window.confirm('Delete this link?')) {
                try {
                  const success = await handleLinkDelete(link.id);
                  if (success) {
                    await loadProjectDetails(projectId);
                  }
                } catch (error) {
                  console.error('Error deleting link:', error);
                }
              }
            }}
            className={`
              px-2 py-1 text-xs rounded
              ${darkMode
                ? 'text-red-400 hover:bg-gray-700'
                : 'text-red-600 hover:bg-red-50'}
            `}
            data-testid={`delete-link-${link.id}`}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }, [darkMode, editingLinkId, editingUrl, handleLinkUpdate, handleLinkDelete, linkLoading, loadProjectDetails, projectId]);

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
                // Generate title from hostname with fallback to URL string
                let tempTitle;
                try {
                  tempTitle = new URL(trimmed).hostname;
                } catch {
                  tempTitle = trimmed;
                }

                const tempLink = {
                  id: `temp-${Date.now()}`,
                  url: trimmed,
                  title: tempTitle
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
                const result = await handleLinkCreate(projectId, trimmed);

                if (result) {
                  // On success, refresh the project details to get the actual link data
                  await loadProjectDetails(projectId);
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
            const result = await handleLinkCreate(projectId, normalized);
            if (result) {
              await loadProjectDetails(projectId);
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
    __ID: PropTypes.string, // Legacy FileMaker support
    id: PropTypes.string,  // Backend API format
    links: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string, // Backend API format (link field)
      link: PropTypes.string, // Backend API field name
      title: PropTypes.string
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired,
  localProject: PropTypes.object,
  setLocalProject: PropTypes.func.isRequired
};

export default React.memo(ProjectLinksTab);