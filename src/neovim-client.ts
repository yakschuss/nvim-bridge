import { execSync } from 'child_process';
import { existsSync } from 'fs';

function findNeovimSocket(): string {
  // 1. Check environment variables
  if (process.env.NVIM_LISTEN_ADDRESS) {
    return process.env.NVIM_LISTEN_ADDRESS;
  }
  if (process.env.NVIM_MCP_SOCKET) {
    return process.env.NVIM_MCP_SOCKET;
  }

  // 2. Check common socket locations
  const user = process.env.USER || 'unknown';
  const candidates = [
    `/tmp/nvim-${user}.sock`,
    `/tmp/nvim.sock`,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'No Neovim socket found. Start Neovim with: nvim --listen /tmp/nvim-$USER.sock <file>'
  );
}

function nvimRemoteSend(keys: string): void {
  const socket = findNeovimSocket();
  // Escape single quotes in keys
  const escaped = keys.replace(/'/g, "'\\''");
  execSync(`nvim --server '${socket}' --remote-send '${escaped}'`, {
    timeout: 5000,
  });
}

function nvimRemoteExpr(expr: string): string {
  const socket = findNeovimSocket();
  const escaped = expr.replace(/'/g, "'\\''");
  const result = execSync(`nvim --server '${socket}' --remote-expr '${escaped}'`, {
    timeout: 5000,
    encoding: 'utf-8',
  });
  return result.trim();
}

export async function isConnected(): Promise<boolean> {
  try {
    const socket = findNeovimSocket();
    if (!existsSync(socket)) return false;
    // Quick test - get current buffer name
    nvimRemoteExpr('1');
    return true;
  } catch {
    return false;
  }
}

export interface BufferInfo {
  filePath: string;
  relativePath: string;
  content: string;
  filetype: string;
  cursor: { line: number; column: number };
  totalLines: number;
  modified: boolean;
}

export async function getBufferInfo(
  startLine?: number,
  endLine?: number,
  includeLineNumbers = true
): Promise<BufferInfo> {
  const filePath = nvimRemoteExpr('expand("%:p")');
  const filetype = nvimRemoteExpr('&filetype');
  const modified = nvimRemoteExpr('&modified') === '1';
  const cursorLine = parseInt(nvimRemoteExpr('line(".")'), 10);
  const cursorCol = parseInt(nvimRemoteExpr('col(".")'), 10);
  const totalLines = parseInt(nvimRemoteExpr('line("$")'), 10);
  const cwd = nvimRemoteExpr('getcwd()');

  // Get lines
  const start = startLine ?? 1;
  const end = endLine ?? totalLines;
  const linesExpr = `join(getline(${start}, ${end}), "\\n")`;
  const rawContent = nvimRemoteExpr(linesExpr);

  let content: string;
  if (includeLineNumbers) {
    content = rawContent
      .split('\n')
      .map((line, i) => `${(start + i).toString().padStart(4)} | ${line}`)
      .join('\n');
  } else {
    content = rawContent;
  }

  const relativePath = filePath.startsWith(cwd)
    ? filePath.slice(cwd.length + 1)
    : filePath;

  return {
    filePath,
    relativePath,
    content,
    filetype,
    cursor: { line: cursorLine, column: cursorCol },
    totalLines,
    modified,
  };
}

export async function setBufferContent(
  content: string,
  startLine?: number,
  endLine?: number
): Promise<{ linesChanged: number }> {
  const lines = content.split('\n');
  const start = startLine ?? 1;
  const end = endLine ?? '$';

  // Write to a temp file and read it in (safer for large content)
  const tempFile = `/tmp/nvim-bridge-${Date.now()}.txt`;
  const { writeFileSync, unlinkSync } = await import('fs');
  writeFileSync(tempFile, content);

  try {
    nvimRemoteSend(`<Esc>:${start},${end}d<CR>:${start - 1}r ${tempFile}<CR>`);
  } finally {
    unlinkSync(tempFile);
  }

  return { linesChanged: lines.length };
}

export interface EditorContext {
  currentFile: {
    path: string;
    relativePath: string;
    filetype: string;
    modified: boolean;
  };
  cursor: { line: number; column: number };
  visualSelection: null;
  diagnostics: Array<{
    line: number;
    severity: string;
    message: string;
    source: string;
  }>;
  openBuffers: Array<{
    path: string;
    modified: boolean;
  }>;
  gitBranch: string | null;
}

export async function getEditorContext(): Promise<EditorContext> {
  const filePath = nvimRemoteExpr('expand("%:p")');
  const filetype = nvimRemoteExpr('&filetype');
  const modified = nvimRemoteExpr('&modified') === '1';
  const cursorLine = parseInt(nvimRemoteExpr('line(".")'), 10);
  const cursorCol = parseInt(nvimRemoteExpr('col(".")'), 10);
  const cwd = nvimRemoteExpr('getcwd()');

  const relativePath = filePath.startsWith(cwd)
    ? filePath.slice(cwd.length + 1)
    : filePath;

  // Get open buffers (simplified)
  const bufCount = parseInt(nvimRemoteExpr('bufnr("$")'), 10);
  const openBuffers: EditorContext['openBuffers'] = [];
  for (let i = 1; i <= Math.min(bufCount, 20); i++) {
    try {
      const bufPath = nvimRemoteExpr(`bufname(${i})`);
      const bufMod = nvimRemoteExpr(`getbufvar(${i}, '&modified')`) === '1';
      if (bufPath) {
        openBuffers.push({ path: bufPath, modified: bufMod });
      }
    } catch {
      // Skip invalid buffers
    }
  }

  // Get git branch
  let gitBranch: string | null = null;
  try {
    const { execSync } = await import('child_process');
    gitBranch = execSync('git branch --show-current 2>/dev/null', {
      encoding: 'utf-8',
      cwd,
    }).trim();
  } catch {
    // Not in git repo
  }

  return {
    currentFile: {
      path: filePath,
      relativePath,
      filetype,
      modified,
    },
    cursor: { line: cursorLine, column: cursorCol },
    visualSelection: null,
    diagnostics: [], // Simplified - would need lua eval for full diagnostics
    openBuffers,
    gitBranch,
  };
}

export async function executeCommand(command: string): Promise<string> {
  nvimRemoteSend(`<Esc>:${command}<CR>`);
  return 'Command sent';
}

export async function executeLua(code: string): Promise<unknown> {
  nvimRemoteSend(`<Esc>:lua ${code}<CR>`);
  return 'Lua executed';
}

export async function navigateToFile(
  path: string,
  line?: number,
  column?: number
): Promise<void> {
  nvimRemoteSend(`<Esc>:edit ${path}<CR>`);
  if (line) {
    nvimRemoteSend(`<Esc>:${line}<CR>`);
    if (column) {
      nvimRemoteSend(`<Esc>0${column - 1}l`);
    }
  }
}
