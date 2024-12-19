import { fileMakerLocal } from '../../services/fileMakerLocal';

export const createPortalManager = (dispatch) => {
  const addNote = async (noteData, taskId, onError) => {
    // Create optimistic note object with current timestamp
    const optimisticNote = {
      'taskNotes::note': noteData.note,
      'taskNotes::_fkID': taskId,
      'taskNotes::~CreationTimestamp': new Date().toISOString()
    };

    try {
      // Create the note in FileMaker (synchronous)
      await fileMakerLocal.createNote({
        note: noteData.note,
        _fkID: taskId
      });

      return optimisticNote;
    } catch (error) {
      console.error('Failed to create note:', error);
      // Call error handler if provided
      if (onError) {
        onError('Failed to create note. Please try again.');
      }
      throw error;
    }
  };

  const addImage = async (imageData, taskId, onError) => {
    // Create optimistic image object
    const optimisticImage = {
      'taskImages::fileName': imageData.fileName,
      'taskImages::_fkID': taskId,
      'taskImages::file': URL.createObjectURL(imageData.file)
    };

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => {
          // Get base64 string without data URL prefix
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(imageData.file);

      const base64Data = await base64Promise;

      // Create the image in FileMaker
      await fileMakerLocal.createImage({
        image_base64: base64Data,
        fileName: imageData.fileName,
        _fkID: taskId
      });

      return optimisticImage;
    } catch (error) {
      console.error('Failed to create image:', error);
      // Call error handler if provided
      if (onError) {
        onError('Failed to upload image. Please try again.');
      }
      throw error;
    }
  };

  const addLink = async (linkData, taskId, onError) => {
    // Create optimistic link object
    const optimisticLink = {
      'taskLinks::link': linkData.link,
      'taskLinks::_fkID': taskId
    };

    try {
      // Create the link in FileMaker (synchronous)
      await fileMakerLocal.createLink({
        link: linkData.link,
        _fkID: taskId
      });

      return optimisticLink;
    } catch (error) {
      console.error('Failed to create link:', error);
      // Call error handler if provided
      if (onError) {
        onError('Failed to create link. Please try again.');
      }
      throw error;
    }
  };

  return {
    addNote,
    addImage,
    addLink
  };
};
