/**
 * sync-version.js
 * 将根目录 package.json 的版本号同步到 client/ 和 server/ 的 package.json
 *
 * 用法：
 *   1. 修改根目录 package.json 的 "version" 字段
 *   2. 运行: npm run sync-version
 *   3. 所有子包版本号自动同步
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// 读取根目录版本号（唯一来源）
const rootPkg = readJson(resolve(__dirname, 'package.json'));
const version = rootPkg.version;

if (!version) {
  console.error('❌ 根目录 package.json 中未找到 version 字段');
  process.exit(1);
}

console.log(`\n📦 同步版本号: v${version}\n`);

// 需要同步的子包
const targets = [
  resolve(__dirname, 'client/package.json'),
  resolve(__dirname, 'server/package.json'),
];

for (const target of targets) {
  try {
    const pkg = readJson(target);
    const oldVersion = pkg.version;
    pkg.version = version;
    writeJson(target, pkg);
    const changed = oldVersion !== version ? `${oldVersion} → ${version}` : `${version} (unchanged)`;
    console.log(`  ✅ ${target.replace(__dirname, '.')}: ${changed}`);
  } catch (err) {
    console.error(`  ❌ 无法更新 ${target}: ${err.message}`);
  }
}

console.log('\n✨ 版本同步完成！\n');
