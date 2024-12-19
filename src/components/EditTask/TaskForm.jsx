import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import ProjectSelect from './ProjectSelect';

const TaskForm = ({
  taskDescription,
  selectedProject,
  priority,
  isModified,
  notes = [],
  images = [],
  links = [],
  onDescriptionChange,
  onProjectChange,
  onPriorityChange,
  onNoteAdd,
  onImageAdd,
  onLinkAdd,
  onCancel,
  onSubmit
}) => {
  const [newNote, setNewNote] = useState('');
  const [newLink, setNewLink] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const projectData = useSelector(state => state.project.projectData);

  // Get customer name from selected project
  const customerName = projectData?.find(
    project => project.fieldData?.__ID === selectedProject
  )?.fieldData?.['Customers::Name'] || '';

  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (newNote.trim()) {
      onNoteAdd({ note: newNote.trim() });
      setNewNote('');
    }
  };

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (newLink.trim()) {
      onLinkAdd({ link: newLink.trim() });
      setNewLink('');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setIsUploading(true);
        setUploadError('');
        setSelectedFileName(file.name);
        await onImageAdd({ file, fileName: file.name });
        
        // Reset file input and states
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSelectedFileName('');
      } catch (error) {
        console.error('Failed to upload file:', error);
        setUploadError('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const inputClasses = "p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800 bg-white";
  const buttonClasses = "px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950 whitespace-nowrap";
  const scrollableContentClasses = "space-y-2 max-h-[200px] overflow-y-auto pr-2";

  // Sort notes by timestamp, newest first
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a['taskNotes::~CreationTimestamp']);
    const dateB = new Date(b['taskNotes::~CreationTimestamp']);
    return dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Task and Status line */}
        <div className="flex gap-4">
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Task description"
            className={`flex-1 ${inputClasses}`}
          />
          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className={`w-40 ${inputClasses} appearance-none`}
          >
            <option value="active">Active</option>
            <option value="next">Next</option>
            <option value="shelved">Backlog</option>
          </select>
        </div>
        
        {/* Customer and Project line */}
        <div className="flex gap-4">
          <input
            type="text"
            value={customerName}
            readOnly
            placeholder="Customer"
            className={`flex-1 ${inputClasses}`}
          />
          <div className="w-40">
            <ProjectSelect
              selectedProject={selectedProject}
              onChange={onProjectChange}
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div id="note container" className="border rounded p-4 max-h-44 overflow-y-auto">
        <h3 className="font-semibold mb-2">Notes</h3>
        <form onSubmit={handleNoteSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            className={`flex-1 ${inputClasses}`}
          />
          <button
            type="submit"
            className={buttonClasses}
          >
            Add Note
          </button>
        </form>
        <div className={notes.length > 1 ? scrollableContentClasses : 'space-y-2'}>
          {sortedNotes.map((note, index) => (
            <div key={note['taskNotes::__ID'] || index} className="bg-gray-50 p-2 rounded">
              <p className="text-sm">{note['taskNotes::note']}</p>
              <p className="text-xs text-gray-500 mt-1">
                {note['taskNotes::~CreationTimestamp']}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Section */}
      <div id="documents container" className="border rounded p-4 max-h-44 overflow-y-auto">
        <h3 className="font-semibold mb-2">Documents</h3>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 truncate text-sm text-gray-600">
            {isUploading ? 'Uploading...' : selectedFileName}
          </div>
          <label className={`${buttonClasses} cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            Choose File
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>
        {uploadError && (
          <div className="text-red-500 text-sm mb-2">{uploadError}</div>
        )}
        <div className={images.length > 1 ? scrollableContentClasses : 'space-y-2'}>
          {images.map((image, index) => (
            <div key={image['taskImages::__ID'] || index} className="bg-gray-50 p-2 rounded flex items-center gap-2">
              <a
                href={image['taskImages::file']}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-800 hover:underline text-sm"
              >
                {image['taskImages::fileName']}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Links Section */}
      <div id="links container" className="border rounded p-4 max-h-44 overflow-y-auto">
        <h3 className="font-semibold mb-2">Links</h3>
        <form onSubmit={handleLinkSubmit} className="flex gap-2 mb-4">
          <input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Add a link..."
            className={`flex-1 ${inputClasses}`}
          />
          <button
            type="submit"
            className={buttonClasses}
          >
            Add Link
          </button>
        </form>
        <div className={links.length > 1 ? scrollableContentClasses : 'space-y-2'}>
          {links.map((link, index) => (
            <div key={link['taskLinks::__ID'] || index} className="bg-gray-50 p-2 rounded">
              <a
                href={link['taskLinks::link']}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-800 hover:underline text-sm"
              >
                {link['taskLinks::link']}
              </a>
              <p className="text-xs text-gray-500 mt-1">
                {link['taskLinks::~CreationTimestamp']}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-cyan-800 border border-cyan-800 rounded hover:bg-gray-100"
        >
          {isModified ? 'Cancel' : 'Close'}
        </button>
        {isModified && (
          <button
            onClick={onSubmit}
            className={buttonClasses}
          >
            Update Task
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskForm;
