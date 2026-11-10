import path from 'path';
import { ProjectFileEntry } from './geminiService.js';

export type FileClassification =
  | 'CONFIG_MANIFEST'
  | 'ENTRY_POINT'
  | 'ROUTER_API'
  | 'DATA_MODEL'
  | 'BUSINESS_SERVICE'
  | 'UI_COMPONENT'
  | 'UTILITY_HELPER'
  | 'TEST'
  | 'DOCUMENTATION'
  | 'OTHER';

export interface CodeEvidence {
  file: string;
  classification: FileClassification;
  language: string;
  size: number;
  todos: Array<{ line: number; type: string; text: string }>;
  stubs: Array<{ line: number; description: string }>;
  imports: string[];
  exports: string[];
  detectedRoutes: Array<{ method: string; path: string; line: number }>;
}

export interface ProjectEvidenceCatalog {
  classifiedFiles: CodeEvidence[];
  manifests: CodeEvidence[];
  entryPoints: CodeEvidence[];
  routers: CodeEvidence[];
  models: CodeEvidence[];
  services: CodeEvidence[];
  uiComponents: CodeEvidence[];
  docs: CodeEvidence[];
  allTodos: Array<{ file: string; line: number; type: string; text: string }>;
  allStubs: Array<{ file: string; line: number; description: string }>;
  detectedRoutes: Array<{ file: string; method: string; path: string; line: number }>;
  uniqueImports: string[];
  inconsistencies: string[];
}

export function classifyFile(filePath: string): FileClassification {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.basename(normalized);

  // 1. Documentation
  if (
    baseName.startsWith('readme') ||
    baseName.startsWith('architecture') ||
    baseName.startsWith('contributing') ||
    baseName.startsWith('changelog') ||
    baseName.startsWith('license') ||
    normalized.includes('/docs/')
  ) {
    return 'DOCUMENTATION';
  }

  // 2. Tests
  if (
    baseName.includes('.test.') ||
    baseName.includes('.spec.') ||
    baseName.endsWith('_test.go') ||
    baseName.endsWith('_test.py') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/')
  ) {
    return 'TEST';
  }

  // 3. Manifests / Configs
  const configNames = [
    'package.json',
    'tsconfig.json',
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
    '.env.example',
    'tailwind.config.js',
  ];
  if (configNames.includes(baseName)) {
    return 'CONFIG_MANIFEST';
  }

  // 4. Entry Points
  const entryNames = [
    'index.ts', 'index.js', 'main.ts', 'main.js', 'main.py', 'app.py',
    'server.ts', 'server.js', 'app.ts', 'app.js', 'main.go', 'main.rs',
    'src/index.tsx', 'src/main.tsx', 'src/app.tsx'
  ];
  if (entryNames.includes(baseName) || normalized.endsWith('/src/index.ts') || normalized.endsWith('/src/main.ts')) {
    return 'ENTRY_POINT';
  }

  // 5. Routers / APIs
  if (
    normalized.includes('/routes/') ||
    normalized.includes('/router/') ||
    normalized.includes('/api/') ||
    normalized.includes('/controllers/') ||
    normalized.includes('/handlers/') ||
    baseName.includes('controller') ||
    baseName.includes('router') ||
    baseName.includes('endpoint')
  ) {
    return 'ROUTER_API';
  }

  // 6. Data Models / Schemas
  if (
    normalized.includes('/models/') ||
    normalized.includes('/schemas/') ||
    normalized.includes('/entities/') ||
    normalized.includes('/migrations/') ||
    normalized.includes('/db/') ||
    baseName.includes('.model.') ||
    baseName.includes('.schema.') ||
    baseName.endsWith('.sql') ||
    baseName.endsWith('.prisma')
  ) {
    return 'DATA_MODEL';
  }

  // 7. Business Services
  if (
    normalized.includes('/services/') ||
    normalized.includes('/usecases/') ||
    normalized.includes('/managers/') ||
    baseName.includes('service')
  ) {
    return 'BUSINESS_SERVICE';
  }

  // 8. UI Components
  if (
    normalized.includes('/components/') ||
    normalized.includes('/pages/') ||
    normalized.includes('/views/') ||
    baseName.endsWith('.tsx') ||
    baseName.endsWith('.jsx') ||
    baseName.endsWith('.vue') ||
    baseName.endsWith('.svelte')
  ) {
    return 'UI_COMPONENT';
  }

  // 9. Utilities & Helpers
  if (
    normalized.includes('/utils/') ||
    normalized.includes('/helpers/') ||
    normalized.includes('/lib/') ||
    normalized.includes('/common/')
  ) {
    return 'UTILITY_HELPER';
  }

  return 'OTHER';
}

export function extractCodeEvidence(file: ProjectFileEntry): CodeEvidence {
  const classification = classifyFile(file.path);
  const lines = file.content.split('\n');

  const todos: Array<{ line: number; type: string; text: string }> = [];
  const stubs: Array<{ line: number; description: string }> = [];
  const imports: string[] = [];
  const exports: string[] = [];
  const detectedRoutes: Array<{ method: string; path: string; line: number }> = [];

  const todoRegex = /(?:\/\/|#|\/\*)\s*(TODO|FIXME|STUB|HACK|XXX|NOTE)\b:?\s*(.*)$/i;
  const stubRegex = /(?:throw new (?:NotImplementedError|Error\(['"`]Not implemented|Error\(['"`]TODO)|raise NotImplementedError|pass\s*#\s*placeholder|\bpanic\("not implemented"\))/i;
  const esmImportRegex = /(?:import\s+(?:.*?\s+from\s+)?|require\()['"]([^'"\n]+)['"]/g;
  const pythonImportRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/;
  const routeRegex = /\b(?:app|router|server)\.(get|post|put|delete|patch|options)\s*\(\s*['"]([^'"]+)['"]/i;
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+([a-zA-Z0-9_]+)/;

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    // Detect TODO / FIXME
    const todoMatch = lineText.match(todoRegex);
    if (todoMatch) {
      todos.push({
        line: lineNum,
        type: todoMatch[1].toUpperCase(),
        text: (todoMatch[2] || '').trim(),
      });
    }

    // Detect explicit stub implementations
    if (stubRegex.test(lineText)) {
      stubs.push({
        line: lineNum,
        description: lineText.trim(),
      });
    }

    // Detect API routes
    const routeMatch = lineText.match(routeRegex);
    if (routeMatch) {
      detectedRoutes.push({
        line: lineNum,
        method: routeMatch[1].toUpperCase(),
        path: routeMatch[2],
      });
    }

    // Detect imports
    let match: RegExpExecArray | null;
    while ((match = esmImportRegex.exec(lineText)) !== null) {
      const imp = match[1];
      if (!imp.startsWith('.')) {
        // External package (e.g. 'express', '@google/generative-ai')
        const pkgName = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
        if (!imports.includes(pkgName)) imports.push(pkgName);
      }
    }

    const pyMatch = lineText.match(pythonImportRegex);
    if (pyMatch) {
      const pkg = pyMatch[1] || pyMatch[2];
      if (pkg && !imports.includes(pkg)) imports.push(pkg.split('.')[0]);
    }

    // Detect exports
    const exportMatch = lineText.match(exportRegex);
    if (exportMatch && exportMatch[1]) {
      if (!exports.includes(exportMatch[1])) exports.push(exportMatch[1]);
    }
  });

  return {
    file: file.path,
    classification,
    language: file.language,
    size: file.size,
    todos,
    stubs,
    imports,
    exports,
    detectedRoutes,
  };
}

export function catalogProjectEvidence(files: ProjectFileEntry[]): ProjectEvidenceCatalog {
  const classifiedFiles = files.map(extractCodeEvidence);

  const manifests = classifiedFiles.filter((f) => f.classification === 'CONFIG_MANIFEST');
  const entryPoints = classifiedFiles.filter((f) => f.classification === 'ENTRY_POINT');
  const routers = classifiedFiles.filter((f) => f.classification === 'ROUTER_API');
  const models = classifiedFiles.filter((f) => f.classification === 'DATA_MODEL');
  const services = classifiedFiles.filter((f) => f.classification === 'BUSINESS_SERVICE');
  const uiComponents = classifiedFiles.filter((f) => f.classification === 'UI_COMPONENT');
  const docs = classifiedFiles.filter((f) => f.classification === 'DOCUMENTATION');

  const allTodos: Array<{ file: string; line: number; type: string; text: string }> = [];
  const allStubs: Array<{ file: string; line: number; description: string }> = [];
  const detectedRoutes: Array<{ file: string; method: string; path: string; line: number }> = [];
  const importSet = new Set<string>();

  classifiedFiles.forEach((cf) => {
    cf.todos.forEach((t) => allTodos.push({ file: cf.file, line: t.line, type: t.type, text: t.text }));
    cf.stubs.forEach((s) => allStubs.push({ file: cf.file, line: s.line, description: s.description }));
    cf.detectedRoutes.forEach((r) => detectedRoutes.push({ file: cf.file, method: r.method, path: r.path, line: r.line }));
    cf.imports.forEach((imp) => importSet.add(imp));
  });

  // Cross-check for inconsistencies
  const inconsistencies: string[] = [];

  // Check if .env.example exists and contains variables
  const envExample = files.find((f) => path.basename(f.path).toLowerCase() === '.env.example');
  if (!envExample) {
    inconsistencies.push('No .env.example found: Environment variable configuration requirements must be inferred.');
  }

  // Check if package manifest exists
  const pkgJson = files.find((f) => path.basename(f.path).toLowerCase() === 'package.json');
  const pyProject = files.find((f) => ['pyproject.toml', 'requirements.txt'].includes(path.basename(f.path).toLowerCase()));
  const cargoToml = files.find((f) => path.basename(f.path).toLowerCase() === 'cargo.toml');

  if (!pkgJson && !pyProject && !cargoToml && files.length > 5) {
    inconsistencies.push('No standard package manifest (package.json, requirements.txt, Cargo.toml) found in root directory.');
  }

  // Check for declared routes without controllers or vice versa
  if (routers.length > 0 && services.length === 0 && models.length === 0) {
    inconsistencies.push('API routes detected without explicit service or data layer (potential monolithic route handlers or incomplete architecture).');
  }

  return {
    classifiedFiles,
    manifests,
    entryPoints,
    routers,
    models,
    services,
    uiComponents,
    docs,
    allTodos,
    allStubs,
    detectedRoutes,
    uniqueImports: Array.from(importSet),
    inconsistencies,
  };
}

