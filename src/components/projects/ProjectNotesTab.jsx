import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNote } from '../../hooks/useNote';
import { useProject } from '../../hooks/useProject';
import TextInput from '../global/TextInput';

function ProjectNotesTab({ project, darkMode }) {
  const [showNewNoteInput, setShowNewNoteInput] = useState(false);
  const [allNotes, setAllNotes] = useState([]);
  const {
    handleNoteCreate,
    handleFetchNotes,
    getPagination,
    loading: noteLoading
  } = useNote();
  const { loadProjectDetails } = useProject();

  // Get pagination state for this project
  const pagination = getPagination('project', project.id);

  // Initialize notes from project
  React.useEffect(() => {
    if (project.notes) {
      setAllNotes(project.notes);
    }
  }, [project.notes]);

  // Load more notes handler
  const handleLoadMore = async () => {
    try {
      const moreNotes = await handleFetchNotes('project', project.id, { append: true });
      if (moreNotes && moreNotes.length > 0) {
        setAllNotes(prev => [...prev, ...moreNotes]);
      }
    } catch (error) {
      console.error('Error loading more notes:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Notes</h3>
        <button
          onClick={() => setShowNewNoteInput(true)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover"
          disabled={noteLoading}
        >
          {noteLoading ? 'Adding...' : 'New Note'}
        </button>
      </div>
      {showNewNoteInput && (
        <div className="mb-4">
          <TextInput
            title="Add Note"
            placeholder="Enter your note..."
            submitLabel="Create"
            onSubmit={async (noteContent) => {
              try {
                // Use project.id - hook handles environment detection
                const result = await handleNoteCreate(project.id, noteContent);
                if (result) {
                  await loadProjectDetails(project.id);
                  setShowNewNoteInput(false);
                }
              } catch (error) {
                console.error('Error creating note:', error);
              }
            }}
            onCancel={() => setShowNewNoteInput(false)}
          />
        </div>
      )}
      {allNotes?.length > 0 ? (
        <div className="space-y-4">
          {allNotes.map(note => {
            // Support both backend API format and FileMaker format
            const noteId = note.id || note.fieldData?.__ID;
            const noteContent = note.content || note.fieldData?.note;
            const noteAuthor = note.author || note.createdBy;
            const noteCreatedAt = note.createdAt || note.created_at;

            return (
              <div
                key={noteId}
                className={`
                  p-4 rounded-lg border
                  ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                `}
              >
                <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{noteContent}</p>
                {(noteAuthor || noteCreatedAt) && (
                  <div className={`mt-2 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    {noteAuthor && <span>By {noteAuthor}</span>}
                    {noteAuthor && noteCreatedAt && <span> • </span>}
                    {noteCreatedAt && <span>{new Date(noteCreatedAt).toLocaleDateString()}</span>}
                  </div>
                )}
              </div>
            );
          })}
          {pagination.hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={noteLoading}
                data-testid="load-more-notes"
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
                  ${noteLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {noteLoading ? 'Loading...' : 'Load More Notes'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`text-center py-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No notes added yet
        </div>
      )}
    </div>
  );
}

ProjectNotesTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    recordId: PropTypes.string, // Legacy FileMaker support
    notes: PropTypes.arrayOf(PropTypes.shape({
      // Backend API format
      id: PropTypes.string,
      content: PropTypes.string,
      author: PropTypes.string,
      createdAt: PropTypes.string,
      created_at: PropTypes.string,
      // FileMaker format
      fieldData: PropTypes.shape({
        __ID: PropTypes.string,
        note: PropTypes.string
      })
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default React.memo(ProjectNotesTab);