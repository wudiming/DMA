import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const EndpointContext = createContext();

export function EndpointProvider({ children }) {
    const [currentEndpoint, setCurrentEndpoint] = useState(() => {
        const saved = localStorage.getItem('dma_current_endpoint') || 'local';
        // Set header immediately during initialization
        axios.defaults.headers.common['X-Endpoint-ID'] = saved;
        return saved;
    });
    const [endpoints, setEndpoints] = useState([]);



    useEffect(() => {
        // 保存当前节点到localStorage
        localStorage.setItem('dma_current_endpoint', currentEndpoint);

        // 配置axios默认header
        axios.defaults.headers.common['X-Endpoint-ID'] = currentEndpoint;
    }, [currentEndpoint]);

    const fetchEndpoints = async () => {
        try {
            // 1. Fetch list
            const response = await axios.get('/api/endpoints');
            const initialList = response.data;

            // Update state with list (preserving existing statuses if possible, or setting to checking)
            setEndpoints(prev => {
                return initialList.map(ep => {
                    const existing = prev.find(p => p.id === ep.id);
                    return { ...ep, status: existing ? existing.status : 'checking' };
                });
            });

            // 2. Fetch statuses
            fetchStatuses();
        } catch (error) {
            console.error('Failed to fetch endpoints:', error);
        }
    };

    const fetchStatuses = async () => {
        try {
            const response = await axios.get('/api/endpoints/status');
            const statuses = response.data;

            setEndpoints(prev => prev.map(ep => {
                const statusObj = statuses.find(s => s.id === ep.id);
                return statusObj ? { ...ep, status: statusObj.status } : ep;
            }));
        } catch (error) {
            console.error('Failed to fetch endpoint statuses:', error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchEndpoints();

        // Poll statuses every 30 seconds
        const interval = setInterval(fetchStatuses, 30000);
        return () => clearInterval(interval);
    }, []);

    const switchEndpoint = (endpointId) => {
        // Update immediately to ensure child components see the new header when they re-render and fetch
        localStorage.setItem('dma_current_endpoint', endpointId);
        axios.defaults.headers.common['X-Endpoint-ID'] = endpointId;
        setCurrentEndpoint(endpointId);
    };

    const refreshEndpoints = () => {
        fetchEndpoints();
    };

    return (
        <EndpointContext.Provider value={{
            currentEndpoint,
            endpoints,
            switchEndpoint,
            refreshEndpoints
        }}>
            {children}
        </EndpointContext.Provider>
    );
}

export function useEndpoint() {
    const context = useContext(EndpointContext);
    if (!context) {
        throw new Error('useEndpoint must be used within EndpointProvider');
    }
    return context;
}
