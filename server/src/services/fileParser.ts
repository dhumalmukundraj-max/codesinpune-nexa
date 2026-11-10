import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { shouldIgnoreFile, detectLanguage, isManifestOrConfig } from '../utils/fileFilter.js';
import type { ProjectFileEntry } from './geminiService.js';

export interface ParsedProject {
  name: string;
  files: ProjectFileEntry[];
  folderStructure: string;
  totalFiles: number;
  totalSize: number;
  languages: Array<{ language: string; count: number; percentage: number }>;
  frameworks: string[];
}

export function parseZipBuffer(zipBuffer: Buffer, originalName: string): ParsedProject {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  const files: ProjectFileEntry[] = [];
  let totalSize = 0;
  const languageCounts: Record<string, number> = {};

  // Filter out directories and metadata entries first
  const validEntries = zipEntries.filter((entry) => {
    const norm = entry.entryName.replace(/\\/g, '/');
    if (entry.isDirectory || norm.endsWith('/')) return false;
    if (norm.startsWith('__MACOSX/') || norm.includes('/__MACOSX/')) return false;
    const base = path.posix.basename(norm);
    if (base.startsWith('._')) return false;
    return true;
  });

  // Find root prefix if zip wraps all files in single folder
  let commonPrefix = '';
  if (validEntries.length > 0) {
    const firstNorm = validEntries[0].entryName.replace(/\\/g, '/').replace(/^\//, '');
    const slashIdx = firstNorm.indexOf('/');
    if (slashIdx > 0) {
      const potentialPrefix = firstNorm.substring(0, slashIdx + 1);
      const allHavePrefix = validEntries.every((e) => {
        const norm = e.entryName.replace(/\\/g, '/').replace(/^\//, '');
        return norm.startsWith(potentialPrefix);
      });
      if (allHavePrefix) {
        commonPrefix = potentialPrefix;
      }
    }
  }

  const structureLines: string[] = [];

  for (const entry of validEntries) {
    let relativePath = entry.entryName.replace(/\\/g, '/').replace(/^\//, '');
    if (commonPrefix && relativePath.startsWith(commonPrefix)) {
      relativePath = relativePath.slice(commonPrefix.length);
    }

    if (!relativePath || shouldIgnoreFile(relativePath)) continue;

    const size = entry.header.size;
    totalSize += size;

    // Record structure line
    structureLines.push(relativePath);

    // Read content for text files under 500KB
    if (size <= 500 * 1024) {
      try {
        const textContent = entry.getData().toString('utf8');
        // Simple binary check: if contains multiple null bytes, skip
        if (!textContent.slice(0, 500).includes('\0')) {
          const lang = detectLanguage(relativePath);
          languageCounts[lang] = (languageCounts[lang] || 0) + 1;

          files.push({
            path: relativePath,
            content: textContent,
            size,
            language: lang,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Sort files: prioritize manifests/configs, then entry points, then smallest files
  files.sort((a, b) => {
    const aConfig = isManifestOrConfig(a.path);
    const bConfig = isManifestOrConfig(b.path);
    if (aConfig && !bConfig) return -1;
    if (!aConfig && bConfig) return 1;
    return a.size - b.size;
  });

  // Calculate languages breakdown
  const totalLangFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
  const languages = Object.entries(languageCounts)
    .map(([lang, count]) => ({
      language: lang,
      count,
      percentage: totalLangFiles > 0 ? Math.round((count / totalLangFiles) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Detect frameworks based on filenames & package.json / pyproject
  const frameworks = detectFrameworks(files);

  let projectName = path.basename(originalName, path.extname(originalName)) || 'Imported Project';
  if (['archive', 'project', 'master', 'main', 'repository', 'code'].includes(projectName.toLowerCase()) && commonPrefix) {
    projectName = commonPrefix.replace(/\/$/, '');
  }

  return {
    name: projectName,
    files,
    folderStructure: structureLines.slice(0, 300).join('\n'),
    totalFiles: files.length,
    totalSize,
    languages,
    frameworks,
  };
}

export function parseLocalDirectory(dirPath: string): ParsedProject {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const files: ProjectFileEntry[] = [];
  const structureLines: string[] = [];
  let totalSize = 0;
  const languageCounts: Record<string, number> = {};

  function traverse(currentDir: string, relPrefix = '') {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const item of items) {
      const relPath = path.join(relPrefix, item.name).replace(/\\/g, '/');

      if (shouldIgnoreFile(relPath)) continue;

      const fullPath = path.join(currentDir, item.name);

      if (item.isDirectory()) {
        traverse(fullPath, relPath);
      } else if (item.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          totalSize += stat.size;
          structureLines.push(relPath);

          if (stat.size <= 500 * 1024) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (!content.slice(0, 500).includes('\0')) {
              const lang = detectLanguage(relPath);
              languageCounts[lang] = (languageCounts[lang] || 0) + 1;

              files.push({
                path: relPath,
                content,
                size: stat.size,
                language: lang,
              });
            }
          }
        } catch {
          // ignore read error
        }
      }
    }
  }

  traverse(dirPath);

  files.sort((a, b) => {
    const aConfig = isManifestOrConfig(a.path);
    const bConfig = isManifestOrConfig(b.path);
    if (aConfig && !bConfig) return -1;
    if (!aConfig && bConfig) return 1;
    return a.size - b.size;
  });

  const totalLangFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
  const languages = Object.entries(languageCounts)
    .map(([lang, count]) => ({
      language: lang,
      count,
      percentage: totalLangFiles > 0 ? Math.round((count / totalLangFiles) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const frameworks = detectFrameworks(files);

  return {
    name: path.basename(dirPath),
    files,
    folderStructure: structureLines.slice(0, 300).join('\n'),
    totalFiles: files.length,
    totalSize,
    languages,
    frameworks,
  };
}

export function parseBrowserUploadedFiles(
  uploadedFiles: Array<{ path: string; content: string; size: number }>
): ParsedProject {
  const files: ProjectFileEntry[] = [];
  const structureLines: string[] = [];
  let totalSize = 0;
  const languageCounts: Record<string, number> = {};

  // Normalize paths and filter valid entries
  const normalizedEntries = (uploadedFiles || []).map((f) => ({
    path: f.path.replace(/\\/g, '/').replace(/^\//, ''),
    content: f.content || '',
    size: f.size || (f.content ? Buffer.byteLength(f.content, 'utf8') : 0),
  })).filter((f) => f.path && !shouldIgnoreFile(f.path));

  // Detect common root folder prefix if all uploaded files share one
  let commonPrefix = '';
  if (normalizedEntries.length > 0) {
    const firstPath = normalizedEntries[0].path;
    const slashIdx = firstPath.indexOf('/');
    if (slashIdx > 0) {
      const potentialPrefix = firstPath.substring(0, slashIdx + 1);
      const allHavePrefix = normalizedEntries.every((e) => e.path.startsWith(potentialPrefix));
      if (allHavePrefix) {
        commonPrefix = potentialPrefix;
      }
    }
  }

  for (const f of normalizedEntries) {
    let relativePath = f.path;
    if (commonPrefix && relativePath.startsWith(commonPrefix)) {
      relativePath = relativePath.slice(commonPrefix.length);
    }

    if (!relativePath || shouldIgnoreFile(relativePath)) continue;

    totalSize += f.size;
    structureLines.push(relativePath);

    const lang = detectLanguage(relativePath);
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;

    files.push({
      path: relativePath,
      content: f.content,
      size: f.size,
      language: lang,
    });
  }

  files.sort((a, b) => {
    const aConfig = isManifestOrConfig(a.path);
    const bConfig = isManifestOrConfig(b.path);
    if (aConfig && !bConfig) return -1;
    if (!aConfig && bConfig) return 1;
    return a.size - b.size;
  });

  const totalLangFiles = Object.values(languageCounts).reduce((a, b) => a + b, 0);
  const languages = Object.entries(languageCounts)
    .map(([lang, count]) => ({
      language: lang,
      count,
      percentage: totalLangFiles > 0 ? Math.round((count / totalLangFiles) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const frameworks = detectFrameworks(files);

  let projectName = commonPrefix ? commonPrefix.replace(/\/$/, '') : '';
  if (!projectName && uploadedFiles.length > 0) {
    const firstRaw = uploadedFiles[0].path.replace(/\\/g, '/').replace(/^\//, '');
    projectName = firstRaw.split('/')[0] || 'Browser Upload Project';
  }
  if (!projectName || projectName.includes('.')) {
    projectName = 'Browser Upload Project';
  }

  return {
    name: projectName,
    files,
    folderStructure: structureLines.slice(0, 300).join('\n'),
    totalFiles: files.length,
    totalSize,
    languages,
    frameworks,
  };
}

// Detect popular frameworks from manifests or files
function detectFrameworks(files: ProjectFileEntry[]): string[] {
  const frameworks = new Set<string>();

  // Check package.json
  const pkgFile = files.find((f) => path.basename(f.path).toLowerCase() === 'package.json');
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react']) frameworks.add('React');
      if (deps['next']) frameworks.add('Next.js');
      if (deps['vue']) frameworks.add('Vue.js');
      if (deps['@angular/core']) frameworks.add('Angular');
      if (deps['svelte']) frameworks.add('Svelte');
      if (deps['express']) frameworks.add('Express');
      if (deps['@nestjs/core']) frameworks.add('NestJS');
      if (deps['fastify']) frameworks.add('Fastify');
      if (deps['electron']) frameworks.add('Electron');
      if (deps['tailwindcss']) frameworks.add('Tailwind CSS');
      if (deps['@supabase/supabase-js']) frameworks.add('Supabase');
      if (deps['prisma']) frameworks.add('Prisma');
      if (deps['mongoose']) frameworks.add('Mongoose / MongoDB');
      if (deps['vite']) frameworks.add('Vite');
    } catch {
      // ignore json parse error
    }
  }

  // Check python files / requirements
  const pyReqs = files.find((f) => ['requirements.txt', 'pyproject.toml'].includes(path.basename(f.path).toLowerCase()));
  if (pyReqs) {
    const text = pyReqs.content.toLowerCase();
    if (text.includes('django')) frameworks.add('Django');
    if (text.includes('flask')) frameworks.add('Flask');
    if (text.includes('fastapi')) frameworks.add('FastAPI');
    if (text.includes('torch') || text.includes('pytorch')) frameworks.add('PyTorch');
    if (text.includes('tensorflow')) frameworks.add('TensorFlow');
  }

  // Check Rust Cargo.toml
  const cargoFile = files.find((f) => path.basename(f.path).toLowerCase() === 'cargo.toml');
  if (cargoFile) {
    const text = cargoFile.content.toLowerCase();
    if (text.includes('actix-web')) frameworks.add('Actix Web');
    if (text.includes('axum')) frameworks.add('Axum');
    if (text.includes('tokio')) frameworks.add('Tokio');
    if (text.includes('tauri')) frameworks.add('Tauri');
  }

  return Array.from(frameworks);
}

