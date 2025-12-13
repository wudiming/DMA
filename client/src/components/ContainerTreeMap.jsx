import React, { useMemo } from 'react';

// 真正的Squarified TreeMap算法实现
function squarify(data, x, y, width, height) {
    if (data.length === 0) return [];

    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    if (totalValue === 0) return [];

    // 标准化数据
    const normalizedData = data.map(item => ({
        ...item,
        normalizedValue: (item.value / totalValue) * width * height
    })).sort((a, b) => b.normalizedValue - a.normalizedValue);

    const result = [];

    function layoutRow(items, x, y, width, height) {
        const isHorizontal = width >= height;
        const totalValue = items.reduce((sum, item) => sum + item.normalizedValue, 0);

        let offset = 0;
        items.forEach(item => {
            const ratio = item.normalizedValue / totalValue;

            if (isHorizontal) {
                const itemWidth = width * ratio;
                result.push({
                    ...item,
                    x: x + offset,
                    y: y,
                    width: itemWidth,
                    height: height
                });
                offset += itemWidth;
            } else {
                const itemHeight = height * ratio;
                result.push({
                    ...item,
                    x: x,
                    y: y + offset,
                    width: width,
                    height: itemHeight
                });
                offset += itemHeight;
            }
        });
    }

    function worst(row, width) {
        if (row.length === 0) return Infinity;

        const sum = row.reduce((s, item) => s + item.normalizedValue, 0);
        const rowMin = Math.min(...row.map(item => item.normalizedValue));
        const rowMax = Math.max(...row.map(item => item.normalizedValue));

        return Math.max(
            (width * width * rowMax) / (sum * sum),
            (sum * sum) / (width * width * rowMin)
        );
    }

    function squarifyRecursive(items, x, y, width, height) {
        if (items.length === 0) return;

        if (items.length === 1) {
            result.push({
                ...items[0],
                x, y, width, height
            });
            return;
        }

        const isHorizontal = width >= height;
        const shortSide = isHorizontal ? height : width;

        let row = [];
        let currentWorst = Infinity;
        let i = 0;

        while (i < items.length) {
            const newRow = [...row, items[i]];
            const newWorst = worst(newRow, shortSide);

            if (newWorst > currentWorst && row.length > 0) {
                // 布局当前行
                const rowValue = row.reduce((s, item) => s + item.normalizedValue, 0);
                const rowThickness = rowValue / (width * height / (isHorizontal ? width : height));

                if (isHorizontal) {
                    layoutRow(row, x, y, rowThickness, height);
                    squarifyRecursive(items.slice(i), x + rowThickness, y, width - rowThickness, height);
                } else {
                    layoutRow(row, x, y, width, rowThickness);
                    squarifyRecursive(items.slice(i), x, y + rowThickness, width, height - rowThickness);
                }
                return;
            }

            row = newRow;
            currentWorst = newWorst;
            i++;
        }

        // 布局最后一行
        layoutRow(row, x, y, width, height);
    }

    squarifyRecursive(normalizedData, x, y, width, height);
    return result;
}

// 容器颜色方案
const getContainerColor = (state, index) => {
    const runningColors = [
        '#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6',
        '#14B8A6', '#3B82F6', '#A855F7', '#F97316', '#06B6D4'
    ];

    if (state === 'running') {
        return runningColors[index % runningColors.length];
    } else if (state === 'paused') {
        return '#FBBF24';
    } else {
        return '#6B7280';
    }
};

// 镜像颜色方案
const getImageColor = (index) => {
    const colors = [
        '#6366F1', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6',
        '#14B8A6', '#EF4444', '#3B82F6', '#A855F7', '#F97316'
    ];
    return colors[index % colors.length];
};

// 存储卷颜色方案
const getVolumeColor = (index) => {
    const colors = [
        '#6366F1', '#10B981', '#F59E0B', '#14B8A6', '#8B5CF6',
        '#3B82F6', '#EC4899', '#A855F7', '#F97316', '#EF4444'
    ];
    return colors[index % colors.length];
};

export default function UniversalTreeMap({
    data,
    type = 'container',
    width = 900,
    height = 400,
    isDark,
    onItemClick
}) {
    const treeMapData = useMemo(() => {
        if (!data || data.length === 0) return [];

        let processedData = [];

        if (type === 'container') {
            processedData = data.map((container, index) => ({
                ...container,
                value: container.state === 'running'
                    ? Math.max(container.memoryUsage / 1024 / 1024, 10)
                    : 50,
                color: getContainerColor(container.state, index),
                displayName: container.name
            }));
        } else if (type === 'image') {
            processedData = data.map((image, index) => ({
                ...image,
                value: Math.max(image.size / 1024 / 1024, 10),
                color: getImageColor(index),
                displayName: image.name
            }));
        } else if (type === 'volume') {
            processedData = data.map((volume, index) => ({
                ...volume,
                value: volume.size / 1024 / 1024,
                color: getVolumeColor(index),
                displayName: volume.name
            }));
        }

        return squarify(processedData, 0, 0, width, height);
    }, [data, type, width, height]);

    if (!data || data.length === 0) {
        return (
            <div
                className={`flex items-center justify-center ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg`}
                style={{ width, height }}
            >
                <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                    暂无数据
                </p>
            </div>
        );
    }

    return (
        <svg width={width} height={height} className="rounded-lg">
            {treeMapData.map((item) => {
                const textSize = Math.min(item.width, item.height) > 80 ? 14 :
                    Math.min(item.width, item.height) > 50 ? 12 : 10;
                const showText = item.width > 40 && item.height > 30;

                return (
                    <g key={item.id} onClick={() => onItemClick?.(item)}>
                        <rect
                            x={item.x}
                            y={item.y}
                            width={item.width}
                            height={item.height}
                            fill={item.color}
                            stroke={isDark ? '#1F2937' : '#FFFFFF'}
                            strokeWidth={2}
                            className="cursor-pointer transition-opacity hover:opacity-80"
                            rx={4}
                        />
                        {showText && (
                            <>
                                <text
                                    x={item.x + item.width / 2}
                                    y={item.y + item.height / 2 - (item.width > 100 && item.height > 60 ? 8 : 0)}
                                    fill="white"
                                    fontSize={textSize}
                                    fontWeight="600"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="pointer-events-none select-none"
                                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
                                >
                                    {item.displayName && item.displayName.length > 15
                                        ? item.displayName.substring(0, 12) + '...'
                                        : item.displayName}
                                </text>
                                {item.width > 100 && item.height > 60 && type === 'container' && (
                                    <text
                                        x={item.x + item.width / 2}
                                        y={item.y + item.height / 2 + 12}
                                        fill="rgba(255,255,255,0.8)"
                                        fontSize={10}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="pointer-events-none select-none"
                                    >
                                        {item.state}
                                    </text>
                                )}
                            </>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
