import React from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const EmailResults = ({ data }) => {
  const isSuccess = (result) => result === 'sim' || result === 'Success';

  return (
    <div className="max-w-4xl mx-auto p-2 bg-white rounded-lg shadow">
      <div className="space-y-4">
        {Object.entries(data).map(([name, details]) => {
          // Skip the error object with code
          if (name === 'error') return null;

          return (
            <div 
              key={name}
              className="flex items-start space-x-3 p-1 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              {isSuccess(details.result) ? (
                <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
              ) : (
                <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {name}
                </p>
                <p className="text-sm text-gray-500">
                  {details.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmailResults;
