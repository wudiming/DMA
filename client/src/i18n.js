import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    zh: {
        translation: {
            app: {
                name: 'Docker 管理应用',
                welcome: '欢迎使用 Docker Manager App'
            },
            nav: {
                dashboard: '概览',
                containers: '容器',
                images: '镜像',
                stacks: '编排',
                volumes: '存储卷',
                networks: '网络',
                endpoints: '节点'
            },
            auth: {
                login: '登录',
                username: '用户名',
                password: '密码',
                loginButton: '登录'
            },
            container: {
                running: '运行中',
                stopped: '已停止',
                start: '启动',
                stop: '停止',
                restart: '重启',
                remove: '删除',
                logs: '日志',
                shell: '终端'
            }
        }
    },
    en: {
        translation: {
            app: {
                name: 'Docker Manager App',
                welcome: 'Welcome to Docker Manager App'
            },
            nav: {
                dashboard: 'Dashboard',
                containers: 'Containers',
                images: 'Images',
                stacks: 'Stacks',
                volumes: 'Volumes',
                networks: 'Networks',
                endpoints: 'Endpoints'
            },
            auth: {
                login: 'Login',
                username: 'Username',
                password: 'Password',
                loginButton: 'Login'
            },
            container: {
                running: 'Running',
                stopped: 'Stopped',
                start: 'Start',
                stop: 'Stop',
                restart: 'Restart',
                remove: 'Remove',
                logs: 'Logs',
                shell: 'Shell'
            }
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'zh',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
