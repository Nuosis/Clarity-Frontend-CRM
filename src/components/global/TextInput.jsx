import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';

function TextInput({ 
    title = 'Input',
    placeholder = 'Enter text...',
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    onSubmit,
    onCancel 
}) {
    const { darkMode } = useTheme();
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className={`
                p-6 rounded-lg max-w-md w-full mx-4
                ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
                <h3 className="text-lg font-semibold mb-4">{title}</h3>
                <form onSubmit={handleSubmit}>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={placeholder}
                        className={`
                            w-full p-2 rounded-md border mb-4 resize-none
                            ${darkMode 
                                ? 'bg-gray-700 border-gray-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-900'}
                        `}
                        rows={4}
                        autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`
                                px-4 py-2 rounded-md
                                ${darkMode 
                                    ? 'bg-gray-700 hover:bg-gray-600' 
                                    : 'bg-gray-200 hover:bg-gray-300'}
                            `}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            disabled={!text.trim()}
                            className={`
                                px-4 py-2 bg-primary text-white rounded-md
                                ${text.trim() ? 'hover:bg-primary-hover' : 'opacity-50 cursor-not-allowed'}
                            `}
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

TextInput.propTypes = {
    title: PropTypes.string,
    placeholder: PropTypes.string,
    submitLabel: PropTypes.string,
    cancelLabel: PropTypes.string,
    onSubmit: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default React.memo(TextInput);