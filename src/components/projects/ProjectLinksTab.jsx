import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useLink } from '../../hooks/useLink';
import { useProject } from '../../hooks/useProject';
import TextInput from '../global/TextInput';

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

  // Memoized renderers
  const renderLink = useCallback((link) => (
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
      {link.title || link.url}
    </a>
  ), [darkMode]);

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
                // Create a temporary link object with a temporary ID
                const tempLink = {
                  id: `temp-${Date.now()}`,
                  url: url.trim(),
                  title: new URL(url.trim()).hostname
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
                const result = await handleLinkCreate(project.__ID, url);
                
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