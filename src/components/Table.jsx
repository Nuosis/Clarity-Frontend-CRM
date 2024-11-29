import React, { useState, useEffect } from 'react';
import '../style.css';

// see https://tailwindui.com/components/application-ui/lists/tables

/**
{
  "table": {
    "title": "string",
    "subtitle": "string",
    "columns": [
      {
        "label": "string", // Display name for the column
        "source": "string", // Path to the data in the record
        "type": "string", // Data type (e.g., "string", "number", "date")
        "key": "string" // Unique identifier for the column
      }
    ]
  },
  "data": [
    {
      "key": "uniqueValue", // Unique identifier for the row (useful for key prop)
      "name": "string",
      "title": "string",
      "email": "string",
      "role": "string"
      // Additional fields as needed
    }
  ]
}
 * @returns 
 */

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Table(json) {
  const title = json.table.title || ""
  const subtitle = json.table.subtitle || ""
  const columns = json.table.columns || []
  const data = json.data || []
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {subtitle}
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            onClick={() => {
              // new user handler
            }}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle">
            <table className="min-w-full border-separate border-spacing-0">
              {/* TABLE HEADER */}
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="sticky top-0 z-10 border-b border-gray-300 bg-white/75 py-3.5 px-3 text-left text-sm font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* TABLE BODY */}
              <tbody>
                {data.map((record, recordIdx) => (
                  <tr key={record.key || recordIdx}>
                    {columns.map((column) => {
                      const cellValue = column.source.split('.').reduce((acc, key) => acc[key], record); // Resolve nested paths
                      const cellStyle = column.type === 'bold' ? 'font-bold' : 'text-gray-500'; // Example styling based on type

                      return (
                        <td
                          key={column.key}
                          className={classNames(
                            recordIdx !== data.length - 1 ? 'border-b border-gray-200' : '',
                            `whitespace-nowrap px-3 py-4 text-sm ${cellStyle}`
                          )}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                    {/* Action Buttons */}
                    <td
                      className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-8 lg:pr-8"
                    >
                      {/* Edit Button */}
                      <button
                        className="mr-2 p-1 rounded bg-gray-300 text-white hover:bg-cyan-600 opacity-50"
                        onClick={() => handleEdit(record)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M17.414 2.586a2 2 0 00-2.828 0L7.121 10.05a1 1 0 00-.263.436l-1 4a1 1 0 001.263 1.263l4-1a1 1 0 00.436-.263l7.465-7.465a2 2 0 000-2.828z" />
                          <path
                            fillRule="evenodd"
                            d="M11 5H3a1 1 0 100 2h6v2H3a1 1 0 100 2h6v2H3a1 1 0 100 2h8a1 1 0 100-2H9v-2h4a1 1 0 100-2h-4V7h4a1 1 0 100-2h-2V3a1 1 0 10-2 0v2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {/* Delete Button */}
                      <button
                        className="p-1 rounded bg-red-500 text-white hover:bg-red-600"
                        onClick={() => handleDelete(record.key)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-8.707a1 1 0 011.414 0L10 10.586l2.293-2.293a1 1 0 111.414 1.414L11.414 12l2.293 2.293a1 1 0 01-1.414 1.414L10 13.414l-2.293 2.293a1 1 0 01-1.414-1.414L8.586 12l-2.293-2.293a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}