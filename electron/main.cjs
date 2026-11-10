const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let isPinned = false;
let launchProjectId = null;
let launchAuthToken = null;

// Parse command line arguments (e.g. electron electron/main.cjs --project=<id>)
for (const arg of process.argv) {
  if (arg.startsWith('--project=')) {
    launchProjectId = arg.split('=')[1];
  } else if (arg.startsWith('--token=')) {
    launchAuthToken = arg.split('=')[1];
  }
}

// Register custom protocol for deep-linking (ernexa://assistant?projectId=...)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('ernexa', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('ernexa');
}

function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'ernexa:') {
      const pid = parsed.searchParams.get('projectId') || parsed.pathname.replace(/^\/\//, '');
      const token = parsed.searchParams.get('token');
      if (pid) {
        launchProjectId = pid;
        if (token) launchAuthToken = token;
        if (mainWindow) {
          mainWindow.webContents.send('set-project-context', { projectId: pid, token });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse deep link URL:', url, err);
  }
}

// Handle single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLinkArg = commandLine.find((arg) => arg.startsWith('ernexa://'));
    if (deepLinkArg) {
      handleDeepLink(deepLinkArg);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 720,
    minWidth: 380,
    minHeight: 520,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: isPinned,
    hasShadow: true,
    resizable: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devUrl = 'http://localhost:5173/assistant';
  const queryParams = [];
  if (launchProjectId) queryParams.push(`projectId=${encodeURIComponent(launchProjectId)}`);
  if (launchAuthToken) queryParams.push(`token=${encodeURIComponent(launchAuthToken)}`);
  queryParams.push('electron=true');
  const fullDevUrl = `${devUrl}?${queryParams.join('&')}`;

  const prodPath = path.join(__dirname, '../client/dist/index.html');

  if (fs.existsSync(prodPath)) {
    // If client is built, try loading dev server first if up, or load file
    mainWindow.loadURL(fullDevUrl).catch(() => {
      mainWindow.loadFile(prodPath, {
        hash: `/assistant?${queryParams.join('&')}`,
      });
    });
  } else {
    mainWindow.loadURL(fullDevUrl);
  }

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-toggle-pin', () => {
  isPinned = !isPinned;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isPinned);
  }
  return isPinned;
});

ipcMain.handle('window-get-pin', () => isPinned);

ipcMain.handle('get-launch-params', () => ({
  projectId: launchProjectId,
  token: launchAuthToken,
}));

// Safe File Selection for Active Project Page/File Analysis (Requirement 10)
ipcMain.handle('dialog-select-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Active Project File or Component to Analyze',
    properties: ['openFile'],
    filters: [
      { name: 'Source Code & Docs', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'json', 'md', 'html', 'css', 'sql'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 500 * 1024) {
      throw new Error('File exceeds 500KB maximum size for assistant analysis.');
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      content,
    };
  } catch (err) {
    console.error('Failed to read selected active file:', err);
    throw err;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
