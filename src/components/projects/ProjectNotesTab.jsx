import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNote } from '../../hooks/useNote';
import { useProject } from '../../hooks/useProject';
import TextInput from '../global/TextInput';
import { FIELD_LIMITS } from '../../utils/inputSanitization';

function ProjectNotesTab({ project, darkMode }) {
  const [showNewNoteInput, setShowNewNoteInput] = useState(false);
  const [allNotes, setAllNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const {
    handleNoteCreate,
    handleNoteUpdate,
    handleNoteDelete,
    handleFetchNotes,
    getPagination,
    updatePagination,
    clearPagination,
    loading: noteLoading
  } = useNote();
  const { loadProjectDetails } = useProject();

  // Get pagination state for this project
  const pagination = getPagination('project', project.id);

  // Initialize notes from project
  React.useEffect(() => {
    if (project.notes) {
      setAllNotes(project.notes);
      const currentPagination = getPagination('project', project.id);
      updatePagination('project', project.id, {
        offset: 0,
        limit: currentPagination.limit,
        hasMore: project.notes.length >= currentPagination.limit,
        total: project.notes.length
      });
    }
  }, [project.id, project.notes, getPagination, updatePagination]);

  // Cleanup pagination state when component unmounts or project changes
  React.useEffect(() => {
    return () => {
      clearPagination('project', project.id);
    };
  }, [project.id, clearPagination]);

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

  // Start editing a note
  const handleStartEdit = (noteId, currentContent) => {
    setEditingNoteId(noteId);
    setEditContent(currentContent);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  // Save edited note
  const handleSaveEdit = async (noteId) => {
    if (!editContent.trim()) {
      return;
    }

    try {
      const result = await handleNoteUpdate(noteId, { content: editContent.trim() });
      if (result) {
        await loadProjectDetails(project.id);
        setEditingNoteId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  // Delete a note
  const handleDelete = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      const success = await handleNoteDelete(noteId);
      if (success) {
        await loadProjectDetails(project.id);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
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
            maxLength={FIELD_LIMITS.NOTE_CONTENT}
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

            const isEditing = editingNoteId === noteId;

            return (
              <div
                key={noteId}
                className={`
                  p-4 rounded-lg border
                  ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                `}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={FIELD_LIMITS.NOTE_CONTENT}
                      className={`
                        w-full p-2 rounded border resize-none
                        ${darkMode
                          ? 'bg-gray-700 border-gray-600 text-gray-200'
                          : 'bg-white border-gray-300 text-gray-900'}
                      `}
                      rows={4}
                      disabled={noteLoading}
                    />
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {editContent.length} / {FIELD_LIMITS.NOTE_CONTENT} characters
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(noteId)}
                        disabled={noteLoading || !editContent.trim()}
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50"
                      >
                        {noteLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={noteLoading}
                        className={`
                          px-3 py-1 rounded
                          ${darkMode
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                        `}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{noteContent}</p>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleStartEdit(noteId, noteContent)}
                          disabled={noteLoading}
                          className={`
                            px-2 py-1 text-sm rounded
                            ${darkMode
                              ? 'text-blue-400 hover:bg-gray-700'
                              : 'text-blue-600 hover:bg-blue-50'}
                          `}
                          data-testid={`edit-note-${noteId}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(noteId)}
                          disabled={noteLoading}
                          className={`
                            px-2 py-1 text-sm rounded
                            ${darkMode
                              ? 'text-red-400 hover:bg-gray-700'
                              : 'text-red-600 hover:bg-red-50'}
                          `}
                          data-testid={`delete-note-${noteId}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {(noteAuthor || noteCreatedAt) && (
                      <div className={`mt-2 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {noteAuthor && <span>By {noteAuthor}</span>}
                        {noteAuthor && noteCreatedAt && <span> • </span>}
                        {noteCreatedAt && <span>{new Date(noteCreatedAt).toLocaleDateString()}</span>}
                      </div>
                    )}
                  </>
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
