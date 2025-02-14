import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      <LoadingSpinner />
      {message && (
        <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
};

export default Loading;
