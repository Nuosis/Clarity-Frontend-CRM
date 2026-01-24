import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../layout/AppLayout';
import { sanitizeText, FIELD_LIMITS } from '../../utils/inputSanitization';

function TextInput({
    title = 'Input',
    placeholder = 'Enter text...',
    submitLabel = 'Submit',
    cancelLabel = 'Cancel',
    onSubmit,
    onCancel,
    isModal = true,
    maxLength = FIELD_LIMITS.GENERIC_LONG_TEXT,
    showCharCount = true
}) {
    const { darkMode } = useTheme();
    const [text, setText] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const value = e.target.value;

        // Check length before sanitization to prevent unexpected truncation
        if (value.length > maxLength) {
            setError(`Maximum ${maxLength} characters allowed`);
            return;
        }

        setText(value);
        setError('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Sanitize before submission
        const sanitized = sanitizeText(text, { trim: true, normalizeWhitespace: true });

        if (!sanitized.trim()) {
            setError('Please enter some text');
            return;
        }

        onSubmit(sanitized);
        setText('');
        setError('');
    };

    const remainingChars = maxLength - text.length;
    const isNearLimit = remainingChars < maxLength * 0.1; // Warn when 90% full

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`
                p-6 rounded-lg max-w-md w-full mx-4
                ${darkMode ? 'bg-gray-800' : 'bg-white'}
            `}>
                <h3 className="text-lg font-semibold mb-4">{title}</h3>
                <form onSubmit={handleSubmit}>
                    <textarea
                        value={text}
                        onChange={handleChange}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        className={`
                            w-full p-2 rounded-md border resize-none
                            ${darkMode
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'}
                            ${error ? 'border-red-500' : ''}
                        `}
                        rows={4}
                        autoFocus
                    />
                    {showCharCount && (
                        <div className={`text-sm mt-1 ${isNearLimit ? 'text-orange-500' : darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {text.length} / {maxLength} characters {isNearLimit && '(near limit)'}
                        </div>
                    )}
                    {error && (
                        <div className="text-red-500 text-sm mt-1">
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end space-x-2 mt-4">
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
                            disabled={!text.trim() || !!error}
                            className={`
                                px-4 py-2 bg-primary text-white rounded-md
                                ${text.trim() && !error ? 'hover:bg-primary-hover' : 'opacity-50 cursor-not-allowed'}
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
    onCancel: PropTypes.func.isRequired,
    maxLength: PropTypes.number,
    showCharCount: PropTypes.bool
};

export default React.memo(TextInput);