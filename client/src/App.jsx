import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Containers from './pages/Containers';
import Images from './pages/Images';
import Volumes from './pages/Volumes';
import Networks from './pages/Networks';
import Stacks from './pages/Stacks';
import Endpoints from './pages/Endpoints';

// 简单的路由保护组件
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('dma_token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    const { t } = useTranslation();

    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />
                <Route
                    path="/containers"
                    element={<ProtectedRoute><Containers /></ProtectedRoute>}
                />
                <Route
                    path="/images"
                    element={<ProtectedRoute><Images /></ProtectedRoute>}
                />
                <Route
                    path="/volumes"
                    element={<ProtectedRoute><Volumes /></ProtectedRoute>}
                />
                <Route
                    path="/networks"
                    element={<ProtectedRoute><Networks /></ProtectedRoute>}
                />
                <Route
                    path="/stacks"
                    element={<ProtectedRoute><Stacks /></ProtectedRoute>}
                />
                <Route
                    path="/endpoints"
                    element={<ProtectedRoute><Endpoints /></ProtectedRoute>}
                />
            </Routes>
        </Router>
    );
}

export default App;
