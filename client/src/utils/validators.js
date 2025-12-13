import yaml from 'js-yaml';

export const validateCompose = (content) => {
    if (!content || content.trim() === '') {
        return null;
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed === '') continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const keyPart = line.substring(0, colonIndex);
            if (/[\u4e00-\u9fa5]/.test(keyPart)) {
                return {
                    message: `键名不能包含中文字符`,
                    line: i + 1
                };
            }
        }
    }

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('\t')) {
            return {
                message: 'YAML不允许使用Tab字符，请使用空格缩进',
                line: i + 1
            };
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed === '') continue;

        if (line.includes('：')) {
            return { message: '发现中文冒号"："，请改用英文":"', line: i + 1 };
        }
    }

    try {
        const doc = yaml.load(content);
        if (!doc || typeof doc !== 'object') {
            return { message: '无效的YAML对象', line: 1 };
        }
        if (!doc.services) {
            return { message: '缺少 "services" 定义', line: 1 };
        }

        // 验证 ports 格式
        if (doc.services) {
            for (const [serviceName, service] of Object.entries(doc.services)) {
                if (service.ports) {
                    if (!Array.isArray(service.ports)) {
                        return { message: `服务 "${serviceName}" 的 ports 必须是列表格式`, line: 1 };
                    }
                }
            }
        }

        return null;
    } catch (e) {
        return {
            message: e.message,
            line: e.mark ? e.mark.line + 1 : 1
        };
    }
};
