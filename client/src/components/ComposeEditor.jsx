import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ComposeEditor({ value, onChange, error, isDark, placeholder, rows = 16 }) {
    const containerRef = useRef(null);
    const [lineCount, setLineCount] = useState(1);

    useEffect(() => {
        const lines = value.split('\n').length;
        setLineCount(lines);
    }, [value]);

    const hasError = Boolean(error);
    const isValid = value && value.trim() !== '' && !hasError;
    const errorLine = error?.line;
    const editorHeight = rows * 24 + 16;

    return (
        <div className="relative">
            <div
                className={`relative rounded-lg border transition-colors ${isValid
                    ? 'border-2 border-green-500'
                    : isDark
                        ? 'border-white/10'
                        : 'border-gray-300'
                    }`}
                style={{ height: `${editorHeight}px` }}
            >
                <div
                    ref={containerRef}
                    className="w-full h-full overflow-auto"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        lineHeight: '24px',
                    }}
                >
                    <div
                        className={`sticky left-0 ${isDark ? 'bg-white/5 text-gray-500' : 'bg-gray-50 text-gray-400'}`}
                        style={{
                            padding: '8px',
                            borderRight: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                        }}
                    >
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div
                                key={i + 1}
                                className="text-right pr-2"
                                style={{ height: '24px', lineHeight: '24px' }}
                            >
                                {errorLine === i + 1 && (
                                    <AlertTriangle className="inline-block w-3.5 h-3.5 text-red-500 mr-1" style={{ verticalAlign: 'middle' }} />
                                )}
                                <span>{i + 1}</span>
                            </div>
                        ))}
                    </div>

                    <div className="relative" style={{ minHeight: '100%' }}>
                        <textarea
                            value={value}
                            onChange={onChange}
                            placeholder={placeholder}
                            className={`w-full resize-none focus:outline-none bg-transparent ${isDark
                                ? 'text-white placeholder-gray-500'
                                : 'text-gray-900 placeholder-gray-400'
                                }`}
                            style={{
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                lineHeight: '24px',
                                padding: '8px',
                                border: 'none',
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                whiteSpace: 'pre',
                                minHeight: '100%',
                                height: `${lineCount * 24 + 16}px`,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
