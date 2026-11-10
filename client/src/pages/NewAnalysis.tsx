import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FolderSearch, 
  Github, 
  Monitor, 
  Sparkles, 
  FileCode, 
  AlertCircle, 
  CheckCircle2, 
  Lock, 
  RefreshCw, 
  ArrowRight,
  Eye,
  Layers,
  Save,
  Search,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { previewProject, runProjectAnalysis, saveProject, launchAssistantWindow } from '../lib/api';
import { SummaryTab } from '../components/analysis/SummaryTab';
import { MermaidViewer } from '../components/MermaidViewer';
import { RoadmapTab } from '../components/analysis/RoadmapTab';
import { ProgressTab } from '../components/analysis/ProgressTab';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { AnalysisData } from '../types';

type SourceMode = 'zip' | 'folder' | 'desktop' | 'github';

const IGNORED_FOLDER_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt',
  'target', 'bin', 'obj', 'vendor', '__pycache__', '.pytest_cache', '.venv', 'env',
  '.idea', '.vscode', 'coverage', '.turbo', '.cache', '__macosx'
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.mp4', '.mov', '.mp3',
  '.wav', '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.pdf', '.exe', '.dll', '.so',
  '.dylib', '.class', '.jar', '.pyc', '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.db', '.sqlite', '.sqlite3', '.iso', '.bin'
]);

function isIgnoredClientPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\//, '');
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1];

  if (!fileName) return true;
  if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName === 'Thumbs.db') return true;

  for (const part of parts.slice(0, -1)) {
    if (IGNORED_FOLDER_NAMES.has(part.toLowerCase())) return true;
  }

  if (fileName.startsWith('.') && fileName !== '.env.example' && !fileName.endsWith('.json') && !fileName.endsWith('.js') && !fileName.endsWith('.ts')) {
    if (fileName === '.gitignore' || fileName === '.dockerignore') return false;
    return true;
  }

  // Check secrets
  if (fileName.toLowerCase() !== '.env.example') {
    if (/^\.env(\..+)?$/i.test(fileName) || /\.pem$/i.test(fileName) || /\.key$/i.test(fileName) || /id_rsa/i.test(fileName) || /credentials\.json$/i.test(fileName)) {
      return true;
    }
  }

  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot !== -1 ? fileName.slice(lastDot).toLowerCase() : '';
  if (BINARY_EXTENSIONS.has(ext)) return true;

  if (fileName.toLowerCase().includes('lock') && (ext === '.json' || ext === '.yaml' || ext === '.toml' || ext === '.lock')) return true;
  if (fileName === 'pnpm-lock.yaml' || fileName === 'yarn.lock' || fileName === 'package-lock.json') return true;

  return false;
}

function isPriorityManifest(filePath: string): boolean {
  const name = filePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
  const manifests = [
    'package.json', 'tsconfig.json', 'readme.md', 'readme.txt', 'readme',
    'pyproject.toml', 'requirements.txt', 'setup.py', 'cargo.toml', 'go.mod',
    'dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'vite.config.ts',
    'vite.config.js', 'next.config.js', 'next.config.mjs', 'tailwind.config.js'
  ];
  return manifests.includes(name);
}

function isPriorityEntryPoint(filePath: string): boolean {
  const name = filePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
  return (
    name.startsWith('index.') ||
    name.startsWith('main.') ||
    name.startsWith('app.') ||
    name.startsWith('server.')
  );
}

export const NewAnalysis: React.FC = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<SourceMode>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<Array<{ path: string; content: string; size: number }>>([]);
  const [localPath, setLocalPath] = useState<string>('');
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [githubToken, setGithubToken] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [projectPassword, setProjectPassword] = useState<string>('');
  const [showAssistantPasswordModal, setShowAssistantPasswordModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileFilterText, setFileFilterText] = useState<string>('');
  const [showAllFiles, setShowAllFiles] = useState<boolean>(true);

  // Preview state
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // Active tab in analysis results
  const [activeTab, setActiveTab] = useState<'summary' | 'flowchart' | 'block' | 'roadmap' | 'progress'>('summary');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [autoSaveDb, setAutoSaveDb] = useState<boolean>(true);
  const [persistedId, setPersistedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Process and filter folder files client-side before sending to server
  const processFolderFiles = async (rawFiles: File[]) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewData(null);

    try {
      // 1. Filter out ignored files client-side first
      const eligibleFiles = rawFiles.filter((f) => {
        const relPath = (f as any).webkitRelativePath || f.name;
        return !isIgnoredClientPath(relPath) && f.size <= 500 * 1024;
      });

      if (eligibleFiles.length === 0) {
        throw new Error('No readable source code files found in selected folder. Ensure your folder contains code files outside ignored directories like node_modules or .git.');
      }

      // 2. Sort to prioritize manifests and entry points
      eligibleFiles.sort((a, b) => {
        const aPath = (a as any).webkitRelativePath || a.name;
        const bPath = (b as any).webkitRelativePath || b.name;
        const aManifest = isPriorityManifest(aPath);
        const bManifest = isPriorityManifest(bPath);
        if (aManifest && !bManifest) return -1;
        if (!aManifest && bManifest) return 1;

        const aEntry = isPriorityEntryPoint(aPath);
        const bEntry = isPriorityEntryPoint(bPath);
        if (aEntry && !bEntry) return -1;
        if (!aEntry && bEntry) return 1;

        return a.size - b.size;
      });

      // 3. Read up to 200 files text content
      const textFiles: Array<{ path: string; content: string; size: number }> = [];
      for (const f of eligibleFiles.slice(0, 200)) {
        try {
          const content = await f.text();
          if (!content.slice(0, 500).includes('\0')) {
            textFiles.push({
              path: ((f as any).webkitRelativePath || f.name).replace(/\\/g, '/'),
              content,
              size: f.size,
            });
          }
        } catch {
          // ignore binary read failure
        }
      }

      if (textFiles.length === 0) {
        throw new Error('No text-based source files could be read from the folder.');
      }

      setFolderFiles(textFiles);
      const firstPath = ((rawFiles[0] as any)?.webkitRelativePath || 'Web Folder').replace(/\\/g, '/');
      const rootFolder = firstPath.includes('/') ? firstPath.split('/')[0] : 'Selected Folder';
      setCustomName(rootFolder);

      await triggerPreview({ files: textFiles, mode: 'folder' });
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to inspect project folder');
      setLoadingPreview(false);
    }
  };

  // 1. Handle File / Source Selection
  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setZipFile(file);
      setCustomName(file.name.replace(/\.[^/.]+$/, ''));
      await triggerPreview({ file, mode: 'zip' });
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFolderFiles(Array.from(e.target.files));
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;

    if (!items && !files) return;

    // Check for ZIP file first
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      const file = files[0];
      setMode('zip');
      setZipFile(file);
      setCustomName(file.name.replace(/\.[^/.]+$/, ''));
      await triggerPreview({ file, mode: 'zip' });
      return;
    }

    // Check if items support webkitGetAsEntry for folders
    if (items && items.length > 0) {
      const extractedFiles: File[] = [];

      async function traverseEntry(entry: any, currentPath = '') {
        if (!entry) return;
        if (entry.isFile) {
          const file = await new Promise<File | null>((resolve) => entry.file(resolve, () => resolve(null)));
          if (file) {
            const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (!isIgnoredClientPath(fullPath)) {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: fullPath,
                writable: false,
              });
              extractedFiles.push(file);
            }
          }
        } else if (entry.isDirectory) {
          if (IGNORED_FOLDER_NAMES.has(entry.name.toLowerCase())) return;
          const dirReader = entry.createReader();
          const entries: any[] = await new Promise((resolve) => {
            const all: any[] = [];
            function readBatch() {
              dirReader.readEntries((batch: any[]) => {
                if (batch.length === 0) resolve(all);
                else {
                  all.push(...batch);
                  readBatch();
                }
              }, () => resolve(all));
            }
            readBatch();
          });
          const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          for (const child of entries) {
            await traverseEntry(child, newPath);
          }
        }
      }

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          await traverseEntry(entry);
        } else {
          const file = items[i].getAsFile();
          if (file && !isIgnoredClientPath(file.name)) {
            extractedFiles.push(file);
          }
        }
      }

      if (extractedFiles.length > 0) {
        setMode('folder');
        await processFolderFiles(extractedFiles);
        return;
      }
    }

    // Fallback: regular files
    if (files.length > 0) {
      const fileList = Array.from(files);
      if (fileList[0].name.toLowerCase().endsWith('.zip')) {
        setMode('zip');
        setZipFile(fileList[0]);
        setCustomName(fileList[0].name.replace(/\.[^/.]+$/, ''));
        await triggerPreview({ file: fileList[0], mode: 'zip' });
      } else {
        setMode('folder');
        await processFolderFiles(fileList);
      }
    }
  };

  // 2. Trigger Preview
  const triggerPreview = async (params: { file?: File; files?: any[]; mode?: SourceMode }) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewData(null);

    const activeSourceMode = params.mode || mode;

    try {
      const formData = new FormData();
      formData.append('sourceType', activeSourceMode);

      if (params.file) {
        formData.append('zipFile', params.file);
      } else if (activeSourceMode === 'zip' && zipFile) {
        formData.append('zipFile', zipFile);
      } else if (params.files) {
        formData.append('folderFiles', JSON.stringify(params.files));
      } else if (activeSourceMode === 'folder' && folderFiles.length > 0) {
        formData.append('folderFiles', JSON.stringify(folderFiles));
      } else if (activeSourceMode === 'github') {
        formData.append('repoUrl', githubUrl);
        if (githubToken) formData.append('githubToken', githubToken);
      } else if (activeSourceMode === 'desktop') {
        formData.append('localPath', localPath);
      } else {
        throw new Error('Please select a project file or folder first.');
      }

      const res = await previewProject(formData);
      setPreviewData(res);
      if (!customName && res.name) {
        setCustomName(res.name);
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to inspect project files');
    } finally {
      setLoadingPreview(false);
    }
  };

  // 3. Trigger Full Gemini Analysis
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStep('Packaging and extracting code files...');

    try {
      const formData = new FormData();
      formData.append('sourceType', mode);
      formData.append('customName', customName || previewData?.name || 'Software Project');
      if (autoSaveDb) {
        formData.append('autoSave', 'true');
      }
      if (projectPassword.trim()) {
        formData.append('projectPassword', projectPassword.trim());
      }

      if (mode === 'zip' && zipFile) {
        formData.append('zipFile', zipFile);
      } else if (mode === 'folder' && folderFiles.length > 0) {
        formData.append('folderFiles', JSON.stringify(folderFiles));
      } else if (mode === 'github') {
        formData.append('repoUrl', githubUrl);
        if (githubToken) formData.append('githubToken', githubToken);
      } else if (mode === 'desktop') {
        formData.append('localPath', localPath);
      } else {
        throw new Error('No project source selected for analysis.');
      }

      setAnalysisStep('Filtering binaries, node_modules, and extracting manifests...');
      await new Promise((r) => setTimeout(r, 600));

      setAnalysisStep('Connecting to Google Gemini API for knowledge reconstruction...');
      const res = await runProjectAnalysis(formData);

      setAnalysisStep('Reconstructing architecture diagrams and mathematical completion...');
      await new Promise((r) => setTimeout(r, 400));

      setAnalysisResult(res);
      if (res.savedProjectId) {
        setPersistedId(res.savedProjectId);
        setSavedSuccess(true);
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'AI Analysis failed. Ensure GEMINI_API_KEY is configured in .env.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 4. Save Project to Database
  const handleSaveProject = async () => {
    if (!analysisResult) return;
    setIsSaving(true);

    try {
      const payload = {
        name: customName || analysisResult.project.name,
        description: analysisResult.analysis.summary?.introduction?.tagline,
        password: projectPassword.trim() || undefined,
        analysis: analysisResult.analysis,
        languages: analysisResult.project.languages,
        frameworks: analysisResult.project.frameworks,
        sourceType: mode,
        repositoryUrl: mode === 'github' ? githubUrl : undefined,
        files: analysisResult.project.files,
      };

      const res = await saveProject(payload);
      setSavedSuccess(true);
      setTimeout(() => {
        navigate(`/projects/${res.project.id}`);
      }, 1200);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-brand-dark tracking-tight">Project Analysis & Ingestion</h1>
        <p className="text-xs text-brand-muted mt-1">
          Supply a project directory, ZIP archive, or repository to reconstruct its knowledge base using Google Gemini.
        </p>
      </div>

      {/* Analysis Input Form (hidden if analysisResult is ready, but can be reset) */}
      {!analysisResult && (
        <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm space-y-6">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-brand-bg border border-brand-border">
            <button
              type="button"
              onClick={() => {
                setMode('zip');
                setPreviewData(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                mode === 'zip'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-stone-700 hover:text-brand-dark'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>ZIP Archive</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('folder');
                setPreviewData(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                mode === 'folder'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-stone-700 hover:text-brand-dark'
              }`}
            >
              <FolderSearch className="w-4 h-4" />
              <span>Browser Folder</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('desktop');
                setPreviewData(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                mode === 'desktop'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-stone-700 hover:text-brand-dark'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Desktop Path</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('github');
                setPreviewData(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                mode === 'github'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-stone-700 hover:text-brand-dark'
              }`}
            >
              <Github className="w-4 h-4" />
              <span>GitHub Repo</span>
            </button>
          </div>

          {/* Mode 1: ZIP Upload */}
          {mode === 'zip' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-brand-primary bg-brand-primary/10 scale-[1.01]'
                  : 'border-brand-border hover:border-brand-primary bg-brand-bg/30 hover:bg-brand-bg/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={handleZipChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-brand-dark">
                {zipFile ? zipFile.name : isDragging ? 'Drop Project ZIP Here' : 'Click or Drag & Drop Project ZIP'}
              </p>
              <p className="text-xs text-brand-muted mt-1">
                Accepts complete or incomplete repository archives (up to 100MB).
              </p>
            </div>
          )}

          {/* Mode 2: Browser Folder */}
          {mode === 'folder' && (
            <div
              onClick={() => folderInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-brand-primary bg-brand-primary/10 scale-[1.01]'
                  : 'border-brand-border hover:border-brand-primary bg-brand-bg/30 hover:bg-brand-bg/50'
              }`}
            >
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={handleFolderChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary mx-auto flex items-center justify-center mb-3">
                <FolderSearch className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-brand-dark">
                {folderFiles.length > 0
                  ? `${folderFiles.length} files selected`
                  : isDragging
                  ? 'Drop Project Folder Here'
                  : 'Click or Drag & Drop Project Folder'}
              </p>
              <p className="text-xs text-brand-muted mt-1">
                Selects and parses project code files directly via browser folder picker or folder drop.
              </p>
            </div>
          )}

          {/* Mode 3: Desktop Path */}
          {mode === 'desktop' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-brand-dark">
                Local Directory Path (Desktop Companion / Server Host)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="e.g. C:\Users\Username\Projects\my-project"
                  className="flex-1 px-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <button
                  type="button"
                  onClick={() => triggerPreview({})}
                  disabled={!localPath || loadingPreview}
                  className="px-4 py-2 bg-stone-900 text-stone-100 rounded-xl text-xs font-semibold hover:bg-black disabled:opacity-50 transition"
                >
                  {loadingPreview ? 'Scanning...' : 'Scan Directory'}
                </button>
              </div>
              <p className="text-[11px] text-brand-muted">
                Direct local paths are scanned on the host machine where Er.NEXA server is running.
              </p>
            </div>
          )}

          {/* Mode 4: GitHub Repository */}
          {mode === 'github' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-dark mb-1">
                  GitHub Repository URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    className="flex-1 px-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <button
                    type="button"
                    onClick={() => triggerPreview({})}
                    disabled={!githubUrl || loadingPreview}
                    className="px-4 py-2 bg-stone-900 text-stone-100 rounded-xl text-xs font-semibold hover:bg-black disabled:opacity-50 transition"
                  >
                    {loadingPreview ? 'Fetching...' : 'Fetch Repo'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-dark mb-1">
                  Personal Access Token (Optional for Private Repos)
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </div>
          )}

          {/* Error notice */}
          {previewError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {/* PREVIEW SECTION (Requirement 6: Display selected project info before analysis) */}
          {previewData && (
            <div className="pt-4 border-t border-brand-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-brand-primary" />
                  <span>Project Inspection Preview</span>
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  {previewData.totalFiles} files detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-brand-bg/40 border border-brand-border">
                  <span className="text-[11px] text-brand-muted font-medium">Estimated Size</span>
                  <div className="text-sm font-bold text-brand-dark mt-0.5">
                    {(previewData.totalSize / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-bg/40 border border-brand-border">
                  <span className="text-[11px] text-brand-muted font-medium">Languages</span>
                  <div className="text-xs font-bold text-brand-dark mt-0.5 truncate">
                    {previewData.languages?.map((l: any) => l.language).join(', ') || 'Various'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-bg/40 border border-brand-border">
                  <span className="text-[11px] text-brand-muted font-medium">Frameworks Detected</span>
                  <div className="text-xs font-bold text-brand-primary mt-0.5 truncate">
                    {previewData.frameworks?.join(', ') || 'Standard / None'}
                  </div>
                </div>
              </div>

              {/* Analyzable Discovered Files Inspector */}
              {((previewData.files && previewData.files.length > 0) || (previewData.sampleFiles && previewData.sampleFiles.length > 0)) && (
                <div className="rounded-2xl border border-brand-border bg-brand-bg/20 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-brand-primary" />
                      <span className="text-xs font-bold text-brand-dark">
                        Discovered Source Files ({previewData.files?.length || previewData.sampleFiles?.length || 0})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={fileFilterText}
                          onChange={(e) => setFileFilterText(e.target.value)}
                          placeholder="Search files by path or language..."
                          className="pl-8 pr-2.5 py-1 text-[11px] bg-white border border-brand-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary w-48 sm:w-64"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAllFiles(!showAllFiles)}
                        className="p-1 rounded-lg hover:bg-stone-200/60 text-stone-600 transition"
                        title={showAllFiles ? 'Collapse files list' : 'Expand files list'}
                      >
                        {showAllFiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {showAllFiles && (
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-brand-border bg-white divide-y divide-stone-100 text-xs shadow-inner">
                      {(() => {
                        const fileList: any[] = previewData.files || previewData.sampleFiles || [];
                        const filtered = fileList.filter((f: any) =>
                          f.path.toLowerCase().includes(fileFilterText.toLowerCase()) ||
                          (f.language && f.language.toLowerCase().includes(fileFilterText.toLowerCase()))
                        );
                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-stone-400 italic">
                              No files match filter "{fileFilterText}"
                            </div>
                          );
                        }
                        return filtered.map((file: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-3.5 py-2 hover:bg-brand-bg/30 transition">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileCode className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                              <span className="font-mono text-[11px] text-stone-800 truncate" title={file.path}>
                                {file.path}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                                {file.language || 'Text'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Project Custom Name & Optional Password Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter project name..."
                    className="w-full px-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">
                    Project Password Protection (Optional)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={projectPassword}
                      onChange={(e) => setProjectPassword(e.target.value)}
                      placeholder="Leave blank for open access..."
                      className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                  <span className="text-[10px] text-brand-muted mt-0.5 block">
                    Requires this password before opening saved knowledge model.
                  </span>
                </div>
              </div>

              {/* Direct Database Persistence Option */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoSaveDb"
                  checked={autoSaveDb}
                  onChange={(e) => setAutoSaveDb(e.target.checked)}
                  className="rounded border-brand-border text-brand-primary focus:ring-brand-primary h-4 w-4"
                />
                <label htmlFor="autoSaveDb" className="text-xs text-stone-700 font-medium select-none cursor-pointer">
                  Directly persist reconstructed model and file metadata to Supabase Database
                </label>
              </div>

              {/* Trigger AI Analysis Button */}
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover shadow-md transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start AI Knowledge Reconstruction</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Animation during Analysis */}
          {isAnalyzing && (
            <div className="p-6 rounded-2xl bg-brand-bg/80 border border-brand-border text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-primary mx-auto" />
              <p className="text-sm font-bold text-brand-dark">{analysisStep}</p>
              <p className="text-xs text-brand-muted">
                Extracting dependencies, analyzing code snippets in batches, and synthesizing knowledge...
              </p>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">AI Analysis Notice:</strong>
                <span>{analysisError}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANALYSIS RESULTS PRESENTATION (Requirement 8: 5 Tabs) */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Header Bar with Save & Assistant Launcher */}
          <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Knowledge Reconstructed
                </span>
              </div>
              <h2 className="text-2xl font-black text-brand-dark mt-1">
                {customName || analysisResult.project.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnalysisResult(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
              >
                Reset / New
              </button>

              {persistedId && (
                <button
                  type="button"
                  onClick={() => {
                    if (projectPassword.trim()) {
                      setShowAssistantPasswordModal(true);
                    } else {
                      launchAssistantWindow(persistedId);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-stone-100 text-xs font-bold hover:bg-black transition shadow-sm"
                >
                  <Layers className="w-4 h-4 text-brand-secondary" />
                  <span>Launch Assistant</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveProject}
                disabled={isSaving || savedSuccess}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover shadow-sm transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savedSuccess ? 'Saved to Supabase!' : isSaving ? 'Saving...' : 'Save Project'}</span>
              </button>
            </div>
          </div>

          {/* 5 Tab Navigation Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-brand-border">
            {[
              { id: 'summary', label: '1. Project Summary' },
              { id: 'flowchart', label: '2. Flowchart' },
              { id: 'block', label: '3. Block Diagram' },
              { id: 'roadmap', label: '4. Development Roadmap' },
              { id: 'progress', label: '5. Project Progress' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'bg-white text-stone-700 hover:bg-brand-bg border border-brand-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Summary */}
          {activeTab === 'summary' && (
            <SummaryTab summary={analysisResult.analysis.summary} />
          )}

          {/* Tab 2: Flowchart */}
          {activeTab === 'flowchart' && (
            <MermaidViewer
              id="flowchart-viewer"
              title="Project Workflow Flowchart"
              chart={analysisResult.analysis.flowchartMermaid}
            />
          )}

          {/* Tab 3: Block Diagram */}
          {activeTab === 'block' && (
            <MermaidViewer
              id="block-viewer"
              title="System Architecture Block Diagram"
              chart={analysisResult.analysis.blockDiagramMermaid}
            />
          )}

          {/* Tab 4: Roadmap */}
          {activeTab === 'roadmap' && (
            <RoadmapTab roadmap={analysisResult.analysis.roadmap} />
          )}

          {/* Tab 5: Progress */}
          {activeTab === 'progress' && (
            <ProgressTab metrics={analysisResult.analysis.progressMetrics} summary={analysisResult.analysis.summary} />
          )}
        </div>
      )}

      {/* Password Prompt Modal for Launch Assistant */}
      {showAssistantPasswordModal && persistedId && (
        <PasswordPromptModal
          projectId={persistedId}
          projectName={customName || 'Saved Project'}
          title="Launch AI Assistant — Password Required"
          description={
            <>
              The project <strong className="text-stone-900">"{customName || 'Saved Project'}"</strong> is password protected. Enter the project password to launch its AI Launch Assistant.
            </>
          }
          submitButtonText="Verify & Launch Assistant"
          onUnlocked={(token) => {
            setShowAssistantPasswordModal(false);
            launchAssistantWindow(persistedId, token);
          }}
          onCancel={() => setShowAssistantPasswordModal(false)}
        />
      )}
    </div>
  );
};

