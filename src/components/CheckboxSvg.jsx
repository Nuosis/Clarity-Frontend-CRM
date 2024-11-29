import React from 'react';

const CheckboxSvg = ({ checked, onChange, task }) => (
  <div className="cursor-pointer" onClick={() => onChange(task)}>
    {checked ? (
      <svg className="w-5 h-5 text-cyan-800" fill="currentColor" viewBox="0 0 20 20">
        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/>
      </svg>
    ) : (
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth="2"/>
      </svg>
    )}
  </div>
);

export default CheckboxSvg;
