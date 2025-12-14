import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/themeStore';

/**
 * EnvironmentVariables Component
 * 环境变量编辑器组件
 * 
 * @param {Array} value - 环境变量数组 [{name, value}, ...]
 * @param {Function} onChange - 变化回调
 */
export default function EnvironmentVariables({ value = [], onChange }) {
    const { t } = useTranslation();
    const { theme } = useThemeStore();
    const isDark = theme === 'dark';

    const handleAdd = () => {
        onChange([...value, { name: '', value: '' }]);
    };

    const handleRemove = (index) => {
        const newValue = value.filter((_, i) => i !== index);
        onChange(newValue);
    };

    const handleChange = (index, field, val) => {
        const newValue = [...value];
        newValue[index] = { ...newValue[index], [field]: val };
        onChange(newValue);
    };

    return (
        <div className="space-y-3">
            {value.map((env, index) => (
                <div key={index} className="flex gap-2 items-center">
                    <input
                        type="text"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-gray-50'} focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
                        placeholder={t('container.env_var_name')}
                        value={env.name}
                        onChange={(e) => handleChange(index, 'name', e.target.value)}
                    />
                    <input
                        type="text"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-gray-50'} focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
                        placeholder={t('container.env_var_value')}
                        value={env.value}
                        onChange={(e) => handleChange(index, 'value', e.target.value)}
                    />
                    <button
                        onClick={() => handleRemove(index)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                        title={t('common.remove')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}

            <button
                onClick={handleAdd}
                className={`w-full py-2 rounded-lg border border-dashed flex items-center justify-center gap-2 text-sm transition-all ${isDark ? 'border-white/20 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5' : 'border-gray-300 text-gray-500 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50'}`}
            >
                <Plus className="w-4 h-4" />
                {t('container.add_env_var')}
            </button>

            {value.length > 0 && (
                <div className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-600'} px-1`}>
                    {t('container.total_env_vars', { count: value.length })}
                </div>
            )}
        </div>
    );
}
