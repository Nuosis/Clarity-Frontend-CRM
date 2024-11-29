import React, { useState, useEffect } from 'react';

const UserInput = ({ initialValue = '', onSubmit, placeholder = '' }) => {
  const [inputValue, setInputValue] = useState(initialValue);

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(inputValue);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 p-2 border rounded focus:ring-2 focus:ring-cyan-800 focus:border-cyan-800"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-cyan-800 text-white rounded hover:bg-cyan-950"
      >
        Submit
      </button>
    </form>
  );
};

export default UserInput;
