import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  FilePlus,
  FileMinus,
  FileEdit,
  Zap,
  Globe,
  Radio
} from 'lucide-react';
import {
  fetchSyncConfig,
  connectGitHubRepo,
  disconnectGitHubRepo,
  triggerManualSync,
  fetchSyncHistory,
  updateSyncInterval,
} from '../../lib/api';
import { GitHubSyncConfig, GitHubSyncHistoryItem } from '../../types';

interface GitHubSyncSectionProps {
  projectId: string;
  projectName: string;
  sourceType?: string;
  repositoryUrl?: string;
}

export const GitHubSyncSection: React.FC<GitHubSyncSectionProps> = ({
  projectId,
  projectName,
  sourceType,
  repositoryUrl,
}) => {
  const [config, setConfig] = useState<GitHubSyncConfig | null>(null);
  const [history, setHistory] = useState<GitHubSyncHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Connection Form State
  const [repoInput, setRepoInput] = useState(repositoryUrl || '');
  const [githubToken, setGithubToken] = useState('');
  const [selectedInterval, setSelectedInterval] = useState<'disabled' | '30m' | '1h' | '6h' | '24h'>('1h');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Generate random webhook secret if empty
  useEffect(() => {
    if (!webhookSecret) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      const secret = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
      setWebhookSecret(secret);
    }
  }, [webhookSecret]);

  // Load configuration and history
  const loadSyncData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [configRes, historyRes] = await Promise.all([
        fetchSyncConfig(projectId),
        fetchSyncHistory(projectId, 15),
      ]);

      if (configRes.config) {
        setConfig(configRes.config);
        setSelectedInterval(configRes.config.sync_interval || 'disabled');
      } else if (repositoryUrl && (sourceType === 'github' || repositoryUrl.includes('github.com'))) {
        setRepoInput(repositoryUrl);
      }
      if (historyRes.history) {
        setHistory(historyRes.history);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load GitHub synchronization data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSyncData();
  }, [projectId]);

  // Handle Connect
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) {
      setErrorMessage('Please enter a valid GitHub repository URL or slug (e.g. owner/repo).');
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await connectGitHubRepo(projectId, {
        repoUrl: repoInput.trim(),
        githubToken: githubToken.trim() || undefined,
        syncInterval: selectedInterval,
        webhookSecret: webhookSecret.trim() || undefined,
      });

      setConfig(res.config);
      setSuccessMessage(res.message || 'Connected to GitHub successfully!');
      await loadSyncData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect repository. Please verify your token and permissions.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this repository? Continuous synchronization will be paused.')) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await disconnectGitHubRepo(projectId);
      setConfig(null);
      setSuccessMessage('Repository disconnected successfully.');
      await loadSyncData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect repository.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Manual "Sync Now"
  const handleSyncNow = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await triggerManualSync(projectId);
      setSuccessMessage(res.message);
      await loadSyncData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Interval Change
  const handleIntervalChange = async (newInterval: string) => {
    setSelectedInterval(newInterval as any);
    try {
      await updateSyncInterval(projectId, newInterval);
      if (config) {
        setConfig({ ...config, sync_interval: newInterval as any });
      }
      setSuccessMessage(`Scheduled sync updated to: ${newInterval === 'disabled' ? 'Disabled' : newInterval}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update schedule interval.');
    }
  };

  const webhookEndpoint = `${window.location.origin}/api/webhooks/github`;

  const copyToClipboard = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedWebhookUrl(true);
      setTimeout(() => setCopiedWebhookUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  if (isLoading && !config) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <RefreshCw className="w-8 h-8 text-[#C1121F] animate-spin mb-3" />
        <p className="text-stone-600 font-medium">Checking repository synchronization status...</p>
      </div>
    );
  }

  const isConnected = config && config.status !== 'disconnected';

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Sync Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Success</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* CONNECTED STATE */}
      {isConnected ? (
        <>
          {/* Main Sync Status Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-[#C1121F]">
                    <GitBranch className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-stone-900 font-mono">
                        {config.repo_owner}/{config.repo_name}
                      </h3>
                      <a
                        href={`https://github.com/${config.repo_owner}/${config.repo_name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-stone-400 hover:text-[#C1121F] transition-colors"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1">
                      <span className="inline-flex items-center gap-1 font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-700">
                        <GitBranch className="w-3 h-3" /> {config.default_branch}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Continuous Sync
                      </span>
                      {config.has_token && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Key className="w-3 h-3" /> Authenticated (PAT Secured)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C1121F] hover:bg-[#9B0E19] text-white font-medium text-sm rounded-xl shadow-sm transition-all disabled:opacity-60 active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Synchronizing Repository...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2.5 border border-stone-200 hover:border-red-300 hover:bg-red-50 text-stone-600 hover:text-red-700 font-medium text-sm rounded-xl transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-6">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Sync Status</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="font-semibold text-stone-800 capitalize">
                    {config.status === 'syncing' ? 'Syncing...' : config.status}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Latest Commit</p>
                <p className="font-mono font-medium text-stone-800 mt-1.5 truncate" title={config.last_commit_sha}>
                  {config.last_commit_sha ? config.last_commit_sha.slice(0, 7) : 'Initial'}
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Last Synchronized</p>
                <p className="font-medium text-stone-800 mt-1.5 text-sm">
                  {config.last_synced_at ? new Date(config.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Auto-Sync Schedule</p>
                <div className="mt-1">
                  <select
                    value={config.sync_interval || 'disabled'}
                    onChange={(e) => handleIntervalChange(e.target.value)}
                    className="w-full bg-white text-xs font-semibold text-stone-800 border border-stone-200 rounded-lg py-1 px-2 focus:ring-2 focus:ring-[#C1121F]/20 focus:outline-none"
                  >
                    <option value="disabled">Disabled (Manual only)</option>
                    <option value="30m">Every 30 minutes</option>
                    <option value="1h">Every 1 hour</option>
                    <option value="6h">Every 6 hours</option>
                    <option value="24h">Daily (Every 24h)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Configuration Guide Card */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/20 rounded-xl text-red-400 border border-red-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold">Real-Time GitHub Webhooks</h4>
                  <p className="text-xs text-stone-300">
                    Instantly analyze incremental code changes upon every developer git push.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full border border-emerald-500/30 self-start md:self-auto">
                HMAC SHA-256 Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Payload URL
                </label>
                <div className="flex items-center gap-2 bg-stone-950/80 p-2.5 rounded-xl border border-stone-700 font-mono text-xs">
                  <span className="truncate flex-1 text-stone-200">{webhookEndpoint}</span>
                  <button
                    onClick={() => copyToClipboard(webhookEndpoint, 'url')}
                    className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors shrink-0"
                    title="Copy Payload URL"
                  >
                    {copiedWebhookUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Secret (Configured on Webhook)
                </label>
                <div className="flex items-center gap-2 bg-stone-950/80 p-2.5 rounded-xl border border-stone-700 font-mono text-xs">
                  <span className="truncate flex-1 text-amber-300">
                    {config.webhook_secret || '••••••••••••••••'}
                  </span>
                  {config.webhook_secret && (
                    <button
                      onClick={() => copyToClipboard(config.webhook_secret!, 'secret')}
                      className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors shrink-0"
                      title="Copy Secret"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-stone-800/60 rounded-xl border border-stone-700/60 text-xs text-stone-300 space-y-1">
              <p className="font-semibold text-white">How to connect in GitHub:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-stone-300">
                <li>Go to GitHub repository <strong>Settings → Webhooks → Add webhook</strong>.</li>
                <li>Paste the <strong>Payload URL</strong> above and select Content type: <code className="text-red-300">application/json</code>.</li>
                <li>Enter the <strong>Secret</strong> and choose event: <code className="text-red-300">Just the push event</code>.</li>
                <li>Save webhook. Er.NEXA will automatically verify cryptographic signatures and incrementally update knowledge.</li>
              </ol>
            </div>
          </div>

          {/* Synchronization History */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h4 className="text-lg font-bold text-stone-900">Synchronization History</h4>
                <p className="text-xs text-stone-500">
                  Continuous audit log of all manual, webhook, and scheduled synchronizations.
                </p>
              </div>
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                {history.length} Record{history.length === 1 ? '' : 's'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-stone-500 text-sm">
                No synchronizations recorded yet. Click "Sync Now" to run an initial synchronization.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 mt-2">
                {history.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  const hasFiles = item.changed_files && item.changed_files.length > 0;

                  return (
                    <div key={item.id} className="py-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start sm:items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full uppercase tracking-wider shrink-0 ${
                              item.trigger_type === 'webhook'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : item.trigger_type === 'scheduled'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : item.trigger_type === 'initial'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}
                          >
                            {item.trigger_type}
                          </span>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 truncate">
                              {item.commit_message || 'Repository sync'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-0.5">
                              {item.commit_sha && (
                                <span className="font-mono bg-stone-100 px-1.5 py-0.2 rounded text-stone-700">
                                  {item.commit_sha.slice(0, 7)}
                                </span>
                              )}
                              {item.commit_author && <span>by {item.commit_author}</span>}
                              <span>•</span>
                              <span>{new Date(item.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                          <span className="text-xs font-medium text-stone-600 bg-stone-50 px-2 py-1 rounded border border-stone-200">
                            {item.files_changed_count} file{item.files_changed_count === 1 ? '' : 's'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                              item.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'failed'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {item.status === 'completed' && <Check className="w-3 h-3" />}
                            {item.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                            {item.status}
                          </span>

                          {hasFiles && (
                            <button
                              onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                              className="p-1 hover:bg-stone-100 rounded text-stone-500"
                              title="Toggle changed files"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Changed Files List */}
                      {isExpanded && hasFiles && (
                        <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs">
                          <p className="font-semibold text-stone-700 mb-2">Changed Files in this Sync:</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {item.changed_files.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-stone-200 font-mono text-[11px]"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {file.status === 'added' ? (
                                    <FilePlus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : file.status === 'deleted' ? (
                                    <FileMinus className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  ) : (
                                    <FileEdit className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  )}
                                  <span className="truncate text-stone-800">{file.filename}</span>
                                </div>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                                    file.status === 'added'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : file.status === 'deleted'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {file.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* DISCONNECTED / CONNECT FORM */
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
          <div className="text-center max-w-md mx-auto mb-6">
            <div className="w-12 h-12 bg-red-50 text-[#C1121F] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-red-100">
              <GitBranch className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">Connect GitHub Repository</h3>
            <p className="text-xs text-stone-600 mt-1">
              Associate "{projectName}" with its GitHub repository to unlock continuous incremental AI analysis, real-time webhooks, and automatic knowledge synchronization.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Repository Slug or URL <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. facebook/react or https://github.com/owner/repo"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:bg-white focus:ring-2 focus:ring-[#C1121F]/20 focus:border-[#C1121F] focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Supports public GitHub repositories directly or private repositories with a Personal Access Token.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Personal Access Token (PAT)
                </label>
                <span className="text-[11px] text-stone-400">Optional for public repos</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  placeholder="ghp_••••••••••••••••••••••••••••••••"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:bg-white focus:ring-2 focus:ring-[#C1121F]/20 focus:border-[#C1121F] focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Requires read-only <code className="bg-stone-100 px-1 py-0.5 rounded">repo</code> scope. Never exposed to browser or client bundles.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Scheduled Background Sync
                </label>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:bg-white focus:ring-2 focus:ring-[#C1121F]/20 focus:outline-none"
                >
                  <option value="disabled">Disabled (Manual / Webhook only)</option>
                  <option value="30m">Every 30 minutes</option>
                  <option value="1h">Every 1 hour</option>
                  <option value="6h">Every 6 hours</option>
                  <option value="24h">Daily (Every 24h)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Webhook Secret
                </label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm font-mono focus:bg-white focus:ring-2 focus:ring-[#C1121F]/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#C1121F] hover:bg-[#9B0E19] text-white font-semibold text-sm rounded-xl shadow-sm transition-all disabled:opacity-60"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Validating GitHub Connection...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" /> Connect Repository & Enable Sync
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

