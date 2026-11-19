const fs = require('node:fs');
const path = require('node:path');

const desktopDir = __dirname;
const projectRoot = path.resolve(desktopDir, '../..');
const stagingDir = path.resolve(desktopDir, 'stack');

if (!stagingDir.startsWith(`${desktopDir}${path.sep}`)) {
  throw new Error('La carpeta temporal de empaquetado está fuera del proyecto.');
}

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

function copy(source, destination) {
  const from = path.join(projectRoot, source);
  const to = path.join(stagingDir, destination);
  if (!fs.existsSync(from)) throw new Error(`Falta el archivo necesario: ${source}`);
  fs.cpSync(from, to, {
    recursive: true,
    filter: (entry) => !/(^|[\\/])(?:\.env(?:\..*)?|\.venv|node_modules|__pycache__)(?:[\\/]|$)|\.pyc$/i.test(path.relative(from, entry)),
  });
}

copy('docker-compose.yml', 'docker-compose.yml');
copy('backend', 'backend');
copy('database', 'database');

for (const file of [
  'app.json',
  'babel.config.js',
  'Dockerfile',
  'expo-env.d.ts',
  'nginx.conf',
  'package-lock.json',
  'package.json',
  'tsconfig.json',
]) {
  copy(path.join('frontend', file), path.join('frontend', file));
}

for (const dir of ['app', 'public', 'src']) {
  copy(path.join('frontend', dir), path.join('frontend', dir));
}

copy('frontend/assets/cesmida-icon.png', 'frontend/assets/cesmida-icon.png');
console.log(`Preparado el stack de Cesmida en ${stagingDir}`);
