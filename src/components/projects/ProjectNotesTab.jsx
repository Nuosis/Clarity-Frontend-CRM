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
                const result = await handleNoteCreate(project.recordId, noteContent);
                if (result) {
                  await loadProjectDetails(project.recordId);
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
          {project.notes.map(note => (
            <div
              key={note.fieldData.__ID}
              className={`
                p-4 rounded-lg border
                ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
              `}
            >
              <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{note.fieldData.note}</p>
            </div>
          ))}
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
    recordId: PropTypes.string.isRequired,
    notes: PropTypes.arrayOf(PropTypes.shape({
      fieldData: PropTypes.shape({
        __ID: PropTypes.string.isRequired,
        note: PropTypes.string.isRequired
      })
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default React.memo(ProjectNotesTab);