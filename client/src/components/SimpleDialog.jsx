import React from 'react';

export default function SimpleDialog({ onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded">
                <h2>Simple Dialog Test</h2>
                <p>This is a fresh file.</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Close</button>
            </div>
        </div>
    );
}
