import { Server, ChevronDown, Check } from 'lucide-react';
import { useEndpoint } from '../context/EndpointContext';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function EndpointSelector({ isDark, popupDirection = 'down' }) {
    const { t } = useTranslation();
    const { currentEndpoint, endpoints, switchEndpoint } = useEndpoint();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const currentEndpointData = endpoints.find(e => e.id === currentEndpoint);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="mb-6" ref={containerRef}>
            <div className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                {t('endpoint.title')}
            </div>

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all ${isDark
                        ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                        : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'
                        }`}
                >
                    <Server className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                        <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {currentEndpointData?.name || t('endpoint.local')}
                            {currentEndpointData?.host && (
                                <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {currentEndpointData.host}
                                </span>
                            )}
                        </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                </button>

                {/* 下拉菜单 - 只显示名称 */}
                {isOpen && (
                    <div className={`absolute ${popupDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 max-h-64 overflow-y-auto ${isDark ? 'glass-menu-dark' : 'glass-menu-light'} rounded-lg z-[100]`}>
                        {endpoints
                            .filter(endpoint => endpoint.status === 'online' || !endpoint.status || endpoint.id === currentEndpoint)
                            .map((endpoint) => (
                                <button
                                    key={endpoint.id}
                                    onClick={() => {
                                        switchEndpoint(endpoint.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-3 py-2.5 flex items-center justify-between transition-all ${currentEndpoint === endpoint.id
                                        ? isDark
                                            ? 'bg-cyan-500/20 text-cyan-400'
                                            : 'bg-cyan-50 text-cyan-600'
                                        : isDark
                                            ? 'hover:bg-white/5 text-gray-300'
                                            : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {endpoint.name}
                                            {endpoint.host && (
                                                <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {endpoint.host}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {endpoint.id === currentEndpoint && (
                                        <Check className="w-4 h-4 text-cyan-500" />
                                    )}
                                </button>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}
