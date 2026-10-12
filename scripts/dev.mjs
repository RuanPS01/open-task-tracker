// Sobe a API e a web juntas em modo de desenvolvimento.
// Substitui o pacote concurrently: só precisamos de dois processos com prefixo
// na saída e de encerrar os dois juntos quando um deles cai.
import { spawn } from 'node:child_process';

const processes = [
  { name: 'api', color: '\x1b[35m', args: ['run', 'dev', '-w', '@ott/api'] },
  { name: 'web', color: '\x1b[36m', args: ['run', 'dev', '-w', '@ott/web'] },
];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function prefixLines(name, color, chunk) {
  const reset = '\x1b[0m';
  return chunk
    .toString()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => `${color}[${name}]${reset} ${line}`)
    .join('\n');
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const { name, color, args } of processes) {
  const child = spawn(npm, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: false });
  child.stdout.on('data', (chunk) => console.info(prefixLines(name, color, chunk)));
  child.stderr.on('data', (chunk) => console.error(prefixLines(name, color, chunk)));
  child.on('exit', (code) => shutdown(code ?? 0));
  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
