import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * GlassSelect — 自定义下拉选择器，替代原生 <select>
 * 支持 glassmorphism 暗黑模式样式，下拉列表完全可控
 *
 * Props:
 *   value       — 当前值
 *   onChange    — (newValue) => void
 *   options     — [{ value, label }]
 *   isDark      — boolean
 *   className   — 额外 className（应用于触发按钮）
 *   placeholder — 无选中时显示文字
 *   size        — 'sm' | 'md'（默认 md）
 *   disabled    — boolean
 */
export default function GlassSelect({
    value,
    onChange,
    options = [],
    isDark,
    className = '',
    placeholder = '请选择',
    size = 'md',
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // 点击外部关闭
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

    const padding = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm';

    const triggerCls = [
        'w-full flex items-center justify-between gap-2 rounded-lg border transition-all cursor-pointer',
        padding,
        isDark
            ? 'bg-white/5 border-white/10 text-gray-100 hover:bg-white/10 hover:border-white/20'
            : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300',
        'focus:outline-none focus:ring-2 focus:ring-cyan-500',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
    ].join(' ');

    const dropdownCls = [
        'absolute z-50 mt-1 w-full rounded-lg border shadow-2xl overflow-hidden',
        isDark
            ? 'bg-gray-900/95 border-white/10 backdrop-blur-xl shadow-black/50'
            : 'bg-white border-gray-200 shadow-gray-200/80',
    ].join(' ');

    return (
        <div ref={ref} className="relative w-full">
            {/* 触发按钮 */}
            <button
                type="button"
                onClick={() => !disabled && setOpen(v => !v)}
                className={triggerCls}
            >
                <span className={value !== undefined && value !== '' ? '' : (isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {selectedLabel}
                </span>
                <ChevronDown
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                />
            </button>

            {/* 下拉列表 */}
            {open && (
                <div className={dropdownCls} style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    {options.map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={[
                                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                                    isSelected
                                        ? isDark
                                            ? 'bg-cyan-500/20 text-cyan-300'
                                            : 'bg-cyan-50 text-cyan-700'
                                        : isDark
                                            ? 'text-gray-200 hover:bg-white/10'
                                            : 'text-gray-700 hover:bg-gray-50',
                                ].join(' ')}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
