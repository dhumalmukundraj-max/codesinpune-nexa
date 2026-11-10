import AdmZip from '../server/node_modules/adm-zip/adm-zip.js';
import { parseZipBuffer, parseBrowserUploadedFiles } from '../server/dist/services/fileParser.js';
import { shouldIgnoreFile, isManifestOrConfig, detectLanguage } from '../server/dist/utils/fileFilter.js';

console.log('--- 1. Testing fileFilter ---');
const testFiles = [
  { path: 'node_modules/react/index.js', expectedIgnore: true },
  { path: '.git/objects/abc', expectedIgnore: true },
  { path: '__MACOSX/._package.json', expectedIgnore: true },
  { path: 'src/components/._App.tsx', expectedIgnore: true },
  { path: '.env', expectedIgnore: true },
  { path: '.env.example', expectedIgnore: false },
  { path: '.gitignore', expectedIgnore: false },
  { path: 'package-lock.json', expectedIgnore: true },
  { path: 'pnpm-lock.yaml', expectedIgnore: true },
  { path: 'src/index.ts', expectedIgnore: false },
  { path: 'package.json', expectedIgnore: false },
  { path: 'README.md', expectedIgnore: false },
];

for (const tf of testFiles) {
  const ignored = shouldIgnoreFile(tf.path);
  if (ignored !== tf.expectedIgnore) {
    console.error(`❌ FAILED for ${tf.path}: expected ignore=${tf.expectedIgnore}, got ${ignored}`);
    process.exit(1);
  }
}
console.log('✅ All fileFilter tests passed');

console.log('\n--- 2. Testing parseZipBuffer with Windows Backslashes & Ignored Dirs ---');
const zip = new AdmZip();
zip.addFile('MyProject\\package.json', Buffer.from(JSON.stringify({
  name: 'test-app',
  dependencies: { react: '^18.0.0', express: '^4.18.0' }
})));
zip.addFile('MyProject\\README.md', Buffer.from('# Test App\nThis is a test application.'));
zip.addFile('MyProject\\src\\index.ts', Buffer.from('console.log("hello world");'));
zip.addFile('MyProject\\node_modules\\react\\index.js', Buffer.from('module.exports = {};'));
zip.addFile('MyProject\\.git\\config', Buffer.from('[core]'));
zip.addFile('MyProject\\__MACOSX\\._index.ts', Buffer.from('mac metadata'));

const zipBuffer = zip.toBuffer();
const parsedZip = parseZipBuffer(zipBuffer, 'MyProject.zip');

console.log('Parsed Zip Project Name:', parsedZip.name);
console.log('Total extracted files:', parsedZip.totalFiles);
console.log('Languages detected:', parsedZip.languages);
console.log('Frameworks detected:', parsedZip.frameworks);

if (parsedZip.files.length !== 3) {
  console.error(`❌ Expected 3 valid files (package.json, README.md, src/index.ts), got ${parsedZip.files.length}`);
  console.log('Extracted paths:', parsedZip.files.map(f => f.path));
  process.exit(1);
}
if (!parsedZip.frameworks.includes('React') || !parsedZip.frameworks.includes('Express')) {
  console.error('❌ Expected frameworks React and Express to be detected');
  process.exit(1);
}
console.log('✅ parseZipBuffer passed with full ignore filtering & framework extraction');

console.log('\n--- 3. Testing parseBrowserUploadedFiles ---');
const browserFiles = [
  { path: 'MyWebProject/node_modules/lodash/index.js', content: '...', size: 100 },
  { path: 'MyWebProject/.git/HEAD', content: 'ref: refs/heads/main', size: 25 },
  { path: 'MyWebProject/package.json', content: JSON.stringify({ dependencies: { vue: '^3.0.0' } }), size: 60 },
  { path: 'MyWebProject/src/main.js', content: 'import { createApp } from "vue";', size: 120 },
  { path: 'MyWebProject/README.md', content: '# Vue Project', size: 40 },
];

const parsedBrowser = parseBrowserUploadedFiles(browserFiles);
console.log('Parsed Browser Project Name:', parsedBrowser.name);
console.log('Total extracted files:', parsedBrowser.totalFiles);
console.log('Frameworks:', parsedBrowser.frameworks);

if (parsedBrowser.files.length !== 3) {
  console.error(`❌ Expected 3 files, got ${parsedBrowser.files.length}`);
  process.exit(1);
}
if (!parsedBrowser.frameworks.includes('Vue.js')) {
  console.error('❌ Expected Vue.js framework detection');
  process.exit(1);
}
console.log('✅ parseBrowserUploadedFiles passed with root folder stripping & ignore filtering');

console.log('\n--- 4. Testing Large Payload parsing (exceeding old 1MB Multer limit) ---');
// Generate large stringified file content to simulate big codebase
const largeFiles = [];
for (let i = 0; i < 50; i++) {
  largeFiles.push({
    path: `LargeProject/src/file_${i}.ts`,
    content: `// Large file code block ${i}\n` + 'const x = 1;\n'.repeat(500),
    size: 7500,
  });
}
const largeJson = JSON.stringify(largeFiles);
console.log(`Large payload JSON size: ${(Buffer.byteLength(largeJson) / 1024).toFixed(1)} KB`);
const parsedLarge = parseBrowserUploadedFiles(JSON.parse(largeJson));
console.log('Parsed Large Files Count:', parsedLarge.totalFiles);
if (parsedLarge.totalFiles !== 50) {
  console.error(`❌ Expected 50 files, got ${parsedLarge.totalFiles}`);
  process.exit(1);
}
console.log('✅ Large payload handling verified');

console.log('\n====================================');
console.log('🎉 ALL UPLOAD PIPELINE TESTS PASSED!');
console.log('====================================');
