import { parseZipBuffer, ParsedProject } from './fileParser.js';

export async function fetchGitHubRepo(repoUrl: string, githubToken?: string): Promise<ParsedProject> {
  // Normalize GitHub URL
  // e.g. https://github.com/owner/repo or github.com/owner/repo or owner/repo
  const cleanUrl = repoUrl.trim().replace(/\/$/, '');
  const match = cleanUrl.match(/(?:https?:\/\/github\.com\/|^)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?$/);

  if (!match) {
    throw new Error('Invalid GitHub repository URL. Format should be: https://github.com/owner/repo');
  }

  const owner = match[1];
  const repo = match[2];

  // Try downloading zipball via GitHub API or public archive URLs
  const branches = ['main', 'master', 'dev', 'trunk'];
  let zipBuffer: Buffer | null = null;
  let lastError = '';

  const headers: Record<string, string> = {
    'User-Agent': 'Er.NEXA-Analyzer',
  };
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  // First try GitHub API zipball endpoint
  try {
    const apiZipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
    const res = await fetch(apiZipUrl, { headers, redirect: 'follow' });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      zipBuffer = Buffer.from(arrayBuf);
    } else if (res.status === 404) {
      lastError = `Repository ${owner}/${repo} not found or is private (require personal access token).`;
    } else {
      lastError = `GitHub API error: ${res.status} ${res.statusText}`;
    }
  } catch (err: any) {
    lastError = err.message;
  }

  // If API rate limited or failed, try direct raw archive download for common branches
  if (!zipBuffer) {
    for (const branch of branches) {
      try {
        const directUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
        const res = await fetch(directUrl, { redirect: 'follow' });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          zipBuffer = Buffer.from(arrayBuf);
          break;
        }
      } catch {
        // try next
      }
    }
  }

  if (!zipBuffer) {
    throw new Error(`Failed to download repository: ${lastError || 'Could not access branches main/master'}`);
  }

  return parseZipBuffer(zipBuffer, repo);
}

