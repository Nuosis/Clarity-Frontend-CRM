import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNote } from '../../hooks/useNote';
import { useProject } from '../../hooks/useProject';
import TextInput from '../global/TextInput';

function ProjectNotesTab({ project, darkMode }) {
  const [showNewNoteInput, setShowNewNoteInput] = useState(false);
  const { handleNoteCreate, loading: noteLoading } = useNote();
  const { loadProjectDetails } = useProject();

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
      {project.notes?.length > 0 ? (
        <div className="space-y-4">
          {project.notes.map(note => {
            // Support both backend API format and FileMaker format
            const noteId = note.id || note.fieldData?.__ID;
            const noteContent = note.content || note.fieldData?.note;
            const noteAuthor = note.author;
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