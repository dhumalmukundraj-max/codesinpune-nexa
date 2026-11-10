import path from 'path';

// Directories to ignore completely
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'target',
  'bin',
  'obj',
  'vendor',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'env',
  '.idea',
  '.vscode',
  'coverage',
  '.turbo',
  '.cache',
  '__macosx',
]);

// Secret or sensitive patterns to skip
export const SECRET_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /\.p12$/i,
  /\.pfx$/i,
  /credentials\.json$/i,
  /secrets?\./i,
];

// Binary and media extensions
export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.wav', '.flac', '.ogg',
  '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib', '.class', '.jar', '.war', '.wasm',
  '.pyc', '.pyd', '.pyo',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.db', '.sqlite', '.sqlite3',
  '.lock', // Skip huge lockfiles to avoid context overflow
]);

// Map extension to language
export const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.less': 'LESS',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.ps1': 'PowerShell',
  '.dockerfile': 'Docker',
  '.env.example': 'Config Template',
};

export function shouldIgnoreFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\//, '');
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1];

  if (!fileName) return true;

  // Check AppleDouble metadata or macOS system files
  if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName === 'Thumbs.db') {
    return true;
  }

  // Check directories
  for (const part of parts.slice(0, -1)) {
    if (IGNORED_DIRS.has(part.toLowerCase())) {
      return true;
    }
  }

  // Check hidden files (except dotfiles like .eslintrc, .env.example)
  if (fileName.startsWith('.') && fileName !== '.env.example' && !fileName.endsWith('.json') && !fileName.endsWith('.js') && !fileName.endsWith('.ts')) {
    if (fileName === '.gitignore' || fileName === '.dockerignore') {
      return false; // keep gitignore to see ignore patterns
    }
    return true;
  }

  // Check secrets
  if (fileName.toLowerCase() !== '.env.example') {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(fileName)) {
        return true;
      }
    }
  }

  // Check binary extensions
  const ext = path.extname(fileName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Skip lock files
  if (fileName.toLowerCase().includes('lock') && (ext === '.json' || ext === '.yaml' || ext === '.toml' || ext === '.lock')) {
    return true;
  }
  if (fileName === 'pnpm-lock.yaml' || fileName === 'yarn.lock' || fileName === 'package-lock.json') {
    return true;
  }

  return false;
}

export function detectLanguage(filePath: string): string {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === 'dockerfile') return 'Docker';
  if (fileName === 'makefile') return 'Makefile';
  if (fileName === 'package.json') return 'Node.js Package';

  const ext = path.extname(fileName).toLowerCase();
  return EXTENSION_MAP[ext] || 'Text';
}

export function isManifestOrConfig(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  const manifests = [
    'package.json',
    'tsconfig.json',
    'readme.md',
    'readme.txt',
    'readme',
    'pyproject.toml',
    'requirements.txt',
    'setup.py',
    'cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'gemfile',
    'composer.json',
    'dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'vite.config.ts',
    'vite.config.js',
    'webpack.config.js',
    'next.config.js',
    'next.config.mjs',
    'tailwind.config.js',
    'tailwind.config.ts',
  ];
  return manifests.includes(fileName);
}

