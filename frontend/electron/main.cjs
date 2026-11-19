const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const APP_URL = 'http://127.0.0.1:8088';
const HEALTH_URL = `${APP_URL}/api/health`;
const STARTUP_TIMEOUT_MS = 30 * 60 * 1000;
const stackDir = app.isPackaged
  ? path.join(process.resourcesPath, 'stack')
  : path.resolve(__dirname, '../..');
const composeFile = path.join(stackDir, 'docker-compose.yml');
let splashWindow;

function setStatus(message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents
    .executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(message)}`)
    .catch(() => {});
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 300,
    frame: false,
    resizable: false,
    backgroundColor: '#F7F6F0',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cesmida</title><style>body{margin:0;background:#F7F6F0;color:#202923;font:15px system-ui,sans-serif;display:grid;place-items:center;height:100vh}main{text-align:center;padding:32px}h1{color:#194D39;font-size:30px;margin:0 0 12px}p{color:#52645A;line-height:1.6;max-width:410px}small{color:#748078}</style><main><h1>cesmida</h1><p id="status">Preparando tu despensa…</p><small>La primera puesta en marcha puede tardar unos minutos.</small></main></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function ensureEnvironmentFile() {
  const directory = app.getPath('userData');
  fs.mkdirSync(directory, { recursive: true });
  const envPath = path.join(directory, 'cesmida-stack.env');
  if (!fs.existsSync(envPath)) {
    const password = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(
      envPath,
      [
        'POSTGRES_USER=cesmida',
        `POSTGRES_PASSWORD=${password}`,
        'POSTGRES_DB=houseStore',
        'WEB_PORT=8088',
        'API_PORT=8001',
        'ALLOWED_ORIGINS=http://localhost:8088,http://127.0.0.1:8088,http://localhost:8081,http://127.0.0.1:8081',
        '',
      ].join('\n'),
      { encoding: 'utf8', mode: 0o600 },
    );
  }
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const set = (key, value) => {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    const line = `${key}=${value}`;
    if (index < 0) lines.push(line);
    else lines[index] = line;
  };
  const existingOrigins = lines.find((line) => line.startsWith('ALLOWED_ORIGINS='))?.slice('ALLOWED_ORIGINS='.length).split(',') ?? [];
  const allowedOrigins = new Set([
    ...existingOrigins,
    'http://localhost:8088',
    'http://127.0.0.1:8088',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ].filter(Boolean));
  set('API_PORT', '8001');
  set('ALLOWED_ORIGINS', [...allowedOrigins].join(','));
  fs.writeFileSync(envPath, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  return envPath;
}

function runDocker(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    const child = spawn('docker', args, { cwd: stackDir, windowsHide: true });
    const append = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-12000);
      const lastLine = output.trim().split(/\r?\n/).at(-1);
      if (lastLine) setStatus(lastLine.slice(-220));
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(new Error(`${error.message}${output ? `\n\n${output.trim()}` : ''}`));
      else resolve(output);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Docker tardó demasiado en responder.'));
    }, timeoutMs);
    child.once('error', (error) => finish(error));
    child.once('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(`Docker terminó con el código ${code}.`));
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDockerIsRunning() {
  try {
    await runDocker(['info'], 15000);
    return;
  } catch {
    setStatus('Iniciando Docker Desktop…');
  }

  try {
    await runDocker(['desktop', 'start'], 60000);
  } catch {
    // The engine may still be starting; verify it below and show a useful error if it is not.
  }

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try {
      await runDocker(['info'], 10000);
      return;
    } catch {
      await delay(2500);
    }
  }

  throw new Error(
    'Docker Desktop no ha iniciado el motor Linux. Comprueba que Virtual Machine Platform y WSL estén habilitados en Windows y reinicia el PC.',
  );
}

function waitForHealth(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(HEALTH_URL, (response) => {
        response.resume();
        if (response.statusCode === 200) return resolve();
        retry();
      });
      request.setTimeout(3000, () => request.destroy());
      request.on('error', retry);
    };
    const retry = () => {
      if (Date.now() >= deadline) return reject(new Error('La API no respondió en tres minutos.'));
      setTimeout(check, 2000);
    };
    check();
  });
}

async function startStack() {
  if (!fs.existsSync(composeFile)) throw new Error('Falta la configuración Docker de Cesmida.');
  await ensureDockerIsRunning();
  setStatus('Preparando la web, la API y la base de datos…');
  const envPath = ensureEnvironmentFile();
  await runDocker(
    [
      'compose',
      '--project-name',
      'cesmida',
      '--env-file',
      envPath,
      '--file',
      composeFile,
      'up',
      '--detach',
      '--build',
    ],
    STARTUP_TIMEOUT_MS,
  );
  setStatus('Esperando a que la despensa esté lista…');
  await waitForHealth();
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    show: false,
    backgroundColor: '#F7F6F0',
    title: 'Cesmida',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    try {
      if (new URL(target).origin !== APP_URL) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  window.loadURL(APP_URL);
  window.once('ready-to-show', () => window.show());
}

app.whenReady().then(async () => {
  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true });
  }
  createSplash();
  try {
    await startStack();
    createMainWindow();
    splashWindow?.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar Cesmida.';
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    await dialog.showMessageBox({
      type: 'error',
      title: 'No se pudo iniciar Cesmida',
      message: 'Docker Desktop necesita atención antes de abrir la aplicación.',
      detail: message,
    });
    app.quit();
  }
});
