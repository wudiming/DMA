import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Globe, Sun, Moon, Loader2 } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { APP_VERSION } from '../constants';

export default function Login() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { theme, toggleTheme } = useThemeStore();

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (username && password) {
            setLoading(true);
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('dma_token', data.token);
                    navigate('/');
                } else {
                    alert(data.message || '登录失败');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('登录失败：' + error.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const isDark = theme === 'dark';

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900' : 'bg-gradient-to-br from-blue-50 via-cyan-50 to-gray-100'} flex items-center justify-center p-4`}>
            <div className="fixed top-6 right-6 flex gap-3">
                <button
                    onClick={toggleLanguage}
                    className={`${isDark ? 'glass glass-hover text-white' : 'bg-white/80 hover:bg-white shadow-sm text-gray-700'} p-3 rounded-lg transition-all`}
                >
                    <Globe className="w-5 h-5" />
                </button>
                <button
                    onClick={toggleTheme}
                    className={`${isDark ? 'glass glass-hover text-white' : 'bg-white/80 hover:bg-white shadow-sm text-gray-700'} p-3 rounded-lg transition-all`}
                >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>

            <div className={`${isDark ? 'glass' : 'bg-white/90 shadow-xl'} w-full max-w-md rounded-2xl p-8 backdrop-blur-sm`}>
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Docker Manager App" className="w-24 h-24" />
                </div>

                <h1 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                    {t('app.name')} <span className="text-sm font-mono text-gray-500 ml-2">{APP_VERSION}</span>
                </h1>
                <p className={`text-center mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('app.welcome')}
                </p>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('auth.username')}
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={`w-full px-4 py-3 rounded-lg ${isDark ? 'glass' : 'bg-gray-50 border border-gray-200'} focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('auth.password')}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full px-4 py-3 rounded-lg ${isDark ? 'glass' : 'bg-gray-50 border border-gray-200'} focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>登录中...</span>
                            </>
                        ) : (
                            <>
                                <LogIn className="w-5 h-5" />
                                {t('auth.loginButton')}
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
