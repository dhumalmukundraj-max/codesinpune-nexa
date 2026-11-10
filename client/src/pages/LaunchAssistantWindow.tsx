import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Pin, 
  Minus, 
  Settings, 
  X, 
  Send, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Cpu, 
  Paperclip,
  Trash2,
  ExternalLink,
  Milestone,
  Shield,
  FileCode,
  SlidersHorizontal,
  ChevronDown,
  Lock,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { askLaunchAssistant, fetchAssistantContext, fetchProjects, unlockProject } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: string;
  activeFileAttached?: string;
}

export const LaunchAssistantWindow: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get('projectId');
  const urlToken = searchParams.get('token');
  const [projectId, setProjectId] = useState<string | null>(urlProjectId);

  // If token is present in URL, store it in sessionStorage for this assistant project
  useEffect(() => {
    if (urlProjectId && urlToken) {
      sessionStorage.setItem(`ernexa_assistant_unlock_${urlProjectId}`, urlToken);
    }
  }, [urlProjectId, urlToken]);

  const [projectList, setProjectList] = useState<any[]>([]);
  const [projectContext, setProjectContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [status, setStatus] = useState<'ready' | 'processing' | 'error'>('ready');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Assistant password unlock state
  const [isProjectLocked, setIsProjectLocked] = useState<boolean>(false);
  const [assistantPassword, setAssistantPassword] = useState<string>('');
  const [showAssistantPassword, setShowAssistantPassword] = useState<boolean>(false);
  const [assistantUnlockError, setAssistantUnlockError] = useState<string | null>(null);
  const [isUnlockingAssistant, setIsUnlockingAssistant] = useState<boolean>(false);

  // Active File Context (Requirement 10: Analyze active project files/pages)
  const [activeFile, setActiveFile] = useState<{ path: string; name: string; content: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webFileInputRef = useRef<HTMLInputElement>(null);

  // Check if running in Electron
  const isElectron = Boolean((window as any).electronAPI?.isElectron);

  // Listen to IPC context changes if in Electron
  useEffect(() => {
    if (isElectron && (window as any).electronAPI) {
      (window as any).electronAPI.getPinState?.().then((pin: boolean) => setIsPinned(pin));
      (window as any).electronAPI.onProjectContextChange?.((data: any) => {
        if (data?.projectId && data.projectId !== projectId) {
          if (data.token) {
            sessionStorage.setItem(`ernexa_assistant_unlock_${data.projectId}`, data.token);
          }
          setProjectId(data.projectId);
          setSearchParams({ projectId: data.projectId, electron: 'true' });
        }
      });
    }
  }, [isElectron, projectId]);

  // Load available projects
  useEffect(() => {
    fetchProjects()
      .then((data) => {
        const list = data.projects || [];
        setProjectList(list);
        if (!projectId && list.length > 0) {
          setProjectId(list[0].id);
        }
      })
      .catch((err) => {
        console.warn('Failed to load project list for assistant:', err);
      });
  }, []);

  // Project Isolation (Requirement 12):
  // When projectId changes, load that project's isolated saved chat history
  useEffect(() => {
    if (!projectId) {
      setLoadingContext(false);
      return;
    }

    setLoadingContext(true);
    setStatus('processing');
    setActiveFile(null); // Clear previous project active file
    setAssistantUnlockError(null);
    setAssistantPassword('');

    // Load isolated chat history for this specific project
    const storedHistory = localStorage.getItem(`ernexa_assistant_history_${projectId}`);
    let initialMessages: Message[] = [];
    if (storedHistory) {
      try {
        initialMessages = JSON.parse(storedHistory);
      } catch {
        initialMessages = [];
      }
    }

    fetchAssistantContext(projectId)
      .then((data) => {
        setProjectContext(data);
        if (data.isLocked) {
          setIsProjectLocked(true);
          setStatus('ready');
          setMessages([]);
          return;
        }

        setIsProjectLocked(false);
        setStatus('ready');

        if (initialMessages.length === 0) {
          initialMessages = [
            {
              role: 'assistant',
              content: `Hello! I am your **Er.NEXA Launch Assistant** for **${data.project?.name}**.\n\nI have loaded this project's isolated knowledge base, including architecture diagrams, verified functionality (${data.project?.completion_percentage}% complete), technical decisions, and upcoming roadmap milestones.\n\nHow can I help you today?`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
        }
        setMessages(initialMessages);
      })
      .catch((err) => {
        console.error('Failed to load assistant context:', err);
        if (err.message?.toLowerCase().includes('password') || err.message?.toLowerCase().includes('locked')) {
          setIsProjectLocked(true);
        }
        setStatus('error');
      })
      .finally(() => {
        setLoadingContext(false);
      });
  }, [projectId]);

  const handleUnlockAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !assistantPassword.trim() || isUnlockingAssistant) return;

    setIsUnlockingAssistant(true);
    setAssistantUnlockError(null);

    try {
      const res = await unlockProject(projectId, assistantPassword.trim());
      if (res.unlockToken) {
        sessionStorage.setItem(`ernexa_assistant_unlock_${projectId}`, res.unlockToken);
      }
      setAssistantPassword('');
      setIsProjectLocked(false);
      setLoadingContext(true);

      const freshData = await fetchAssistantContext(projectId, res.unlockToken);
      setProjectContext(freshData);
      setStatus('ready');

      const welcomeMsg: Message = {
        role: 'assistant',
        content: `Hello! I am your **Er.NEXA Launch Assistant** for **${freshData.project?.name}**.\n\nI have unlocked and loaded this project's isolated knowledge base, including architecture diagrams, verified functionality (${freshData.project?.completion_percentage}% complete), technical decisions, and upcoming roadmap milestones.\n\nHow can I help you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMsg]);
    } catch (err: any) {
      setAssistantUnlockError(err.message || 'Incorrect project password. Please try again.');
    } finally {
      setIsUnlockingAssistant(false);
      setLoadingContext(false);
    }
  };

  // Persist project-specific messages
  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(`ernexa_assistant_history_${projectId}`, JSON.stringify(messages));
    }
  }, [messages, projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || !projectId || isSending || isProjectLocked) return;

    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      activeFileAttached: activeFile ? activeFile.name : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsSending(true);
    setStatus('processing');

    try {
      const activeFileContext = activeFile ? { path: activeFile.path, content: activeFile.content } : undefined;
      const res = await askLaunchAssistant(projectId, text.trim(), messages, activeFileContext);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.response,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus('ready');
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Notice:** ${err.message || 'Failed to generate response. Please ensure GEMINI_API_KEY is configured in .env.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  const handleTogglePin = async () => {
    if (isElectron && (window as any).electronAPI?.togglePin) {
      const pinState = await (window as any).electronAPI.togglePin();
      setIsPinned(pinState);
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handleMinimize = () => {
    if (isElectron && (window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleClose = () => {
    if (isElectron && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    } else {
      window.close();
    }
  };

  // Safe file attachment through Electron or web input (Requirement 10)
  const handleSelectActiveFile = async () => {
    if (isElectron && (window as any).electronAPI?.selectActiveFile) {
      try {
        const file = await (window as any).electronAPI.selectActiveFile();
        if (file) {
          setActiveFile({
            path: file.path,
            name: file.name,
            content: file.content,
          });
        }
      } catch (err: any) {
        alert(err.message || 'Failed to select file');
      }
    } else {
      webFileInputRef.current?.click();
    }
  };

  const handleWebFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      try {
        const text = await f.text();
        setActiveFile({
          path: f.name,
          name: f.name,
          content: text,
        });
      } catch {
        alert('Could not read selected file.');
      }
    }
  };

  const handleClearHistory = () => {
    if (projectId) {
      localStorage.removeItem(`ernexa_assistant_history_${projectId}`);
      setMessages([
        {
          role: 'assistant',
          content: `Conversation reset for **${projectContext?.project?.name}**. How can I help you?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const project = projectContext?.project;
  const analysis = projectContext?.analysis;
  const completionPercentage = project?.completion_percentage || 0;
  const unfinishedCount = analysis?.summary?.unfinishedTasks?.length || 0;
  const functionalitiesCount = analysis?.summary?.existingFunctionalities?.length || 0;

  const suggestedPills = [
    'Explain system architecture',
    'Show unfinished tasks & TODOs',
    'What are the next development steps?',
    'List verified technical decisions',
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#141210]/95 text-stone-200 select-none overflow-hidden rounded-2xl border border-stone-800 shadow-2xl backdrop-blur-2xl">
      {/* Hidden web file input for browser fallback */}
      <input
        ref={webFileInputRef}
        type="file"
        onChange={handleWebFileSelect}
        className="hidden"
      />

      {/* 1. Header (Custom titlebar styled like Er.AXON screenshot) */}
      <div className="app-drag-region flex items-center justify-between px-3.5 py-2.5 bg-stone-900/90 border-b border-stone-800">
        <div className="flex items-center gap-2 app-no-drag">
          <div className="w-5 h-5 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
            N
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-stone-100 truncate max-w-[140px]">
              {project ? project.name : 'Er.NEXA'}
            </span>
            <span className="text-[10px] text-stone-400 font-medium">Assistant</span>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-stone-800 text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'ready'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'processing'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-stone-300 capitalize">{status}</span>
          </div>
        </div>

        {/* Window Controls: Pin, Settings, Minimize, Close */}
        <div className="flex items-center gap-1 app-no-drag">
          <button
            type="button"
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin window (Always on top: ON)' : 'Pin on top (Always on top: OFF)'}
            className={`p-1 rounded hover:bg-stone-800 transition ${isPinned ? 'text-brand-secondary bg-stone-800' : 'text-stone-400'}`}
          >
            <Pin className="w-3.5 h-3.5 rotate-45" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Assistant Settings & Project Scope"
            className={`p-1 rounded hover:bg-stone-800 transition ${showSettings ? 'text-brand-secondary bg-stone-800' : 'text-stone-400'}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize"
            className="p-1 rounded hover:bg-stone-800 text-stone-400 transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close Assistant"
            className="p-1 rounded hover:bg-red-900/60 text-stone-400 hover:text-red-300 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Project Switcher & Progress Bar (Requirement 11 & 12) */}
      <div className="px-3.5 py-1.5 bg-stone-900/40 border-b border-stone-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-3.5 h-3.5 text-brand-secondary flex-shrink-0" />
          <select
            value={projectId || ''}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSearchParams({ projectId: e.target.value, electron: isElectron ? 'true' : 'false' });
            }}
            className="bg-stone-800/90 text-stone-200 border border-stone-700 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-secondary max-w-[180px] truncate"
          >
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Progress Metric Badge (Requirement 11) */}
        {project && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] font-bold text-brand-primary">{completionPercentage}%</span>
            <div className="w-16 h-1.5 rounded-full bg-stone-800 overflow-hidden">
              <div
                style={{ width: `${completionPercentage}%` }}
                className="h-full bg-brand-primary rounded-full transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Settings Slide-Over Drawer */}
      {showSettings && (
        <div className="bg-stone-900/95 border-b border-stone-800 p-3.5 text-xs space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-stone-800">
            <span className="font-bold text-stone-200 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-brand-secondary" />
              <span>Session Isolation & Grounding</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-stone-400 hover:text-stone-200"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-stone-800/60 border border-stone-700/60">
              <span className="text-stone-400 block">Verified Functions</span>
              <strong className="text-stone-100 text-xs">{functionalitiesCount} implemented</strong>
            </div>
            <div className="p-2 rounded-lg bg-stone-800/60 border border-stone-700/60">
              <span className="text-stone-400 block">Remaining Work</span>
              <strong className="text-brand-primary text-xs">{unfinishedCount} tasks/stubs</strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-stone-400 truncate">
              ID: {projectId || 'None'}
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-stone-800 px-2 py-1 rounded transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Reset Chat</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Chat Message Body */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs">
        {loadingContext ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-secondary" />
            <span className="text-xs">Loading isolated project knowledge...</span>
          </div>
        ) : isProjectLocked ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                <Shield className="w-3 h-3" />
                <span>Password Required</span>
              </div>
              <h3 className="text-base font-bold text-stone-100">
                Unlock Launch Assistant
              </h3>
              <p className="text-[11px] text-stone-400 max-w-xs leading-relaxed">
                The project <strong className="text-stone-200">"{project?.name || 'Selected Project'}"</strong> is protected with a password. Enter the password below to decrypt its knowledge model and enable the assistant.
              </p>
            </div>

            {assistantUnlockError && (
              <div className="w-full max-w-xs p-2.5 rounded-xl bg-red-900/40 border border-red-700/60 text-xs text-red-200 text-left flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                <span>{assistantUnlockError}</span>
              </div>
            )}

            <form onSubmit={handleUnlockAssistant} className="w-full max-w-xs space-y-3">
              <div className="relative text-left">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type={showAssistantPassword ? 'text' : 'password'}
                  value={assistantPassword}
                  onChange={(e) => {
                    setAssistantPassword(e.target.value);
                    if (assistantUnlockError) setAssistantUnlockError(null);
                  }}
                  placeholder="Enter project password..."
                  autoFocus
                  required
                  className="w-full pl-9 pr-9 py-2 text-xs bg-stone-800 text-stone-100 placeholder-stone-500 border border-stone-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowAssistantPassword(!showAssistantPassword)}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-200"
                  title={showAssistantPassword ? "Hide password" : "Show password"}
                >
                  {showAssistantPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isUnlockingAssistant || !assistantPassword.trim()}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-stone-900 text-xs font-bold rounded-xl disabled:opacity-40 transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {isUnlockingAssistant ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Unlock Assistant Knowledge</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 text-brand-primary mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-stone-100">{project?.name || 'Project Assistant'}</p>
              <p className="text-[11px] text-stone-400 max-w-xs mx-auto mt-1 leading-relaxed">
                Reconstructed software knowledge assistant. Answers questions exclusively grounded in this project's code, diagrams, decisions, and roadmap.
              </p>
            </div>

            {/* Quick Metrics Badge in Central Welcome Screen */}
            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 max-w-xs mx-auto text-left space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400 font-medium">Project Progress</span>
                <span className="font-bold text-brand-primary">{completionPercentage}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                <div style={{ width: `${completionPercentage}%` }} className="h-full bg-brand-primary rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                <span>{functionalitiesCount} Verified Functions</span>
                <span>{unfinishedCount} Remaining Tasks</span>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.activeFileAttached && (
                <div className="flex items-center gap-1 text-[10px] text-brand-secondary mb-1 px-1">
                  <FileCode className="w-3 h-3" />
                  <span>Context: {msg.activeFileAttached}</span>
                </div>
              )}

              <div
                className={`max-w-[90%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-brand-primary text-white rounded-br-none shadow-sm'
                    : 'bg-stone-800/90 text-stone-200 border border-stone-700/80 rounded-bl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed space-y-1 font-sans">
                  {msg.content}
                </div>

                {/* Grounding Source Tags (Requirement 9) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-700/60 flex flex-wrap gap-1">
                    <span className="text-[10px] text-stone-400 font-semibold block w-full mb-0.5">
                      Grounding Evidence Sources:
                    </span>
                    {msg.sources.map((src, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-brand-secondary border border-stone-700 truncate max-w-full"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-stone-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 5. Suggested Quick Action Pills (Central Welcome) */}
      {messages.length <= 2 && !loadingContext && !isProjectLocked && (
        <div className="px-3.5 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar border-t border-stone-800/60">
          {suggestedPills.map((pill, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(pill)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 whitespace-nowrap transition"
            >
              {pill}
            </button>
          ))}
        </div>
      )}

      {/* 6. Active File Inspection Banner (Requirement 10) */}
      {activeFile && (
        <div className="px-3.5 py-1.5 bg-stone-900 border-t border-stone-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-brand-secondary truncate">
            <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Active File: <strong>{activeFile.name}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFile(null)}
            className="text-stone-400 hover:text-stone-200 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 7. Chat Input Area */}
      {isProjectLocked ? (
        <div className="p-3 bg-stone-900/90 border-t border-stone-800 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>Enter project password above to unlock Launch Assistant</span>
        </div>
      ) : (
        <div className="p-3 bg-stone-900/90 border-t border-stone-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Attach Active Project File button */}
            <button
              type="button"
              onClick={handleSelectActiveFile}
              title="Inspect & attach active project file or page component"
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-brand-secondary border border-stone-700 transition"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask about ${project ? project.name : 'project'}...`}
              disabled={isSending || loadingContext}
              className="flex-1 bg-stone-800 text-stone-100 placeholder-stone-500 text-xs px-3 py-2 rounded-xl border border-stone-700 focus:outline-none focus:ring-1 focus:ring-brand-secondary disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending || loadingContext}
              className="p-2 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-hover disabled:opacity-40 transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Bottom Utility Controls */}
          <div className="flex items-center justify-between text-[10px] text-stone-500 mt-2 px-1">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-stone-400" />
              <span>Google Gemini 2.5 Flash</span>
            </span>
            <span className="truncate max-w-[170px]">
              {project ? `Context: ${project.name}` : 'No Project Selected'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
