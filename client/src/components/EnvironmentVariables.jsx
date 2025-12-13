import React, { useState } from 'react';
import { Input, Button, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

/**
 * EnvironmentVariables Component
 * 环境变量编辑器组件
 * 
 * @param {Array} value - 环境变量数组 [{name, value}, ...]
 * @param {Function} onChange - 变化回调
 */
export default function EnvironmentVariables({ value = [], onChange }) {
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
        <div className="environment-variables">
            {value.map((env, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                    <Input
                        className="flex-1"
                        placeholder="变量名"
                        value={env.name}
                        onChange={(e) => handleChange(index, 'name', e.target.value)}
                    />
                    <Input
                        className="flex-1"
                        placeholder="值"
                        value={env.value}
                        onChange={(e) => handleChange(index, 'value', e.target.value)}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemove(index)}
                    />
                </div>
            ))}
            <Button
                type="dashed"
                onClick={handleAdd}
                block
                icon={<PlusOutlined />}
            >
                添加环境变量
            </Button>
            {value.length > 0 && (
                <Tag color="blue" style={{ marginTop: 8 }}>
                    共 {value.length} 个变量
                </Tag>
            )}
        </div>
    );
}
