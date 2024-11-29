import React from 'react';
import '../style.css';

function Loading({ message }) {
    return (
        <div className="text-gray-600 text-center text-lg py-10">
            {message || "Loading"}
            <span className="dot-animation">...</span>
        </div>
    );
}

export default Loading;