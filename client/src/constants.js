// 版本号由 Vite 构建时从 client/package.json 自动注入
// 更新版本时只需修改 client/package.json 的 "version" 字段即可
// eslint-disable-next-line no-undef
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
