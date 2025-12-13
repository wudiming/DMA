import React from 'react';

export default function UpdateProgressModal({ isDark, containers, onClose, onSuccess }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded">
                <h2>Modal Loaded Successfully</h2>
                <p>If you see this, the component structure is correct.</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Close</button>
            </div>
        </div>
    );
}
