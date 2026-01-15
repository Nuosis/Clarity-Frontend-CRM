import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * ProjectImagesTab component - Displays project images
 * Environment-aware: Supports both backend API and FileMaker data formats
 *
 * Note: Image upload functionality is handled separately (Supabase Storage, S3, Cloudinary, etc.)
 * This component only displays image metadata from the database.
 *
 * @param {Object} props - Component props
 * @param {Object} props.project - Project object containing images array
 * @param {boolean} props.darkMode - Dark mode flag
 */
function ProjectImagesTab({ project, darkMode }) {
  const [selectedImage, setSelectedImage] = useState(null);

  const images = project.images || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pr-5">
        <h3 className="text-lg font-semibold">Images</h3>
        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </div>
      </div>

      {images.length > 0 ? (
        <>
          {/* Image Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
            {images.map(image => {
              // Support both backend API format and FileMaker format
              const imageId = image.id || image.__ID;
              const imageUrl = image.url;
              const imageTitle = image.title || image.file_name || 'Image';
              const imageDescription = image.description;

              return (
                <div
                  key={imageId}
                  className={`
                    relative group cursor-pointer rounded-lg overflow-hidden border
                    ${darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}
                  `}
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="aspect-square">
                    <img
                      src={imageUrl}
                      alt={imageTitle}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback for broken images
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" text-anchor="middle" x="50" y="50" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  {imageTitle && (
                    <div className={`
                      absolute bottom-0 left-0 right-0 p-2
                      bg-gradient-to-t from-black/70 to-transparent
                      text-white text-sm truncate
                    `}>
                      {imageTitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Image Modal */}
          {selectedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setSelectedImage(null)}
            >
              <div
                className={`
                  relative max-w-4xl max-h-full rounded-lg overflow-hidden
                  ${darkMode ? 'bg-gray-800' : 'bg-white'}
                `}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Image */}
                <div className="max-h-[80vh] overflow-auto">
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.title || selectedImage.file_name || 'Image'}
                    className="w-full h-auto"
                  />
                </div>

                {/* Image Info */}
                {(selectedImage.title || selectedImage.description) && (
                  <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    {selectedImage.title && (
                      <h4 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {selectedImage.title}
                      </h4>
                    )}
                    {selectedImage.description && (
                      <p className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                        {selectedImage.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No images added yet
        </div>
      )}
    </div>
  );
}

ProjectImagesTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    images: PropTypes.arrayOf(PropTypes.shape({
      // Backend API format
      id: PropTypes.string,
      url: PropTypes.string.isRequired,
      title: PropTypes.string,
      description: PropTypes.string,
      file_name: PropTypes.string,
      storage_provider: PropTypes.string,
      created_at: PropTypes.string,
      // FileMaker format
      __ID: PropTypes.string
    }))
  }).isRequired,
  darkMode: PropTypes.bool.isRequired
};

export default React.memo(ProjectImagesTab);
