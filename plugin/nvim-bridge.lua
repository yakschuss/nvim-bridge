-- nvim-bridge: Claude Code <-> Neovim integration
-- https://github.com/yakschuss/nvim-bridge
--
-- Commands:
--   :ClaudePair    - Make this nvim receive Claude's edits
--   :ClaudeStatus  - Check if this nvim is paired

local M = {}
local user = os.getenv('USER') or 'unknown'
local socket_link = '/tmp/nvim-' .. user .. '.sock'

vim.api.nvim_create_user_command('ClaudePair', function()
  local socket = vim.v.servername
  if socket == '' then
    vim.notify('nvim-bridge: Start nvim with --listen flag', vim.log.levels.ERROR)
    return
  end

  -- Create symlink pointing to this nvim's socket
  os.remove(socket_link)
  local ok = os.execute('ln -s "' .. socket .. '" "' .. socket_link .. '"')

  if ok then
    vim.notify('✓ Claude now pushes to this nvim', vim.log.levels.INFO)
  else
    vim.notify('Failed to create socket link', vim.log.levels.ERROR)
  end
end, { desc = 'Make this nvim receive Claude edits' })

vim.api.nvim_create_user_command('ClaudeStatus', function()
  local socket = vim.v.servername

  if socket == '' then
    vim.notify('No socket - start nvim with --listen', vim.log.levels.WARN)
    return
  end

  -- Check what the symlink points to
  local f = io.popen('readlink "' .. socket_link .. '" 2>/dev/null')
  local target = f and f:read('*a'):gsub('%s+$', '') or ''
  if f then f:close() end

  if socket == target then
    vim.notify('✓ This nvim is receiving Claude edits', vim.log.levels.INFO)
  else
    vim.notify('✗ Another nvim is receiving Claude edits\n  Run :ClaudePair to switch', vim.log.levels.WARN)
  end
end, { desc = 'Check Claude pairing status' })

-- Auto-pair on startup if no other nvim is paired
vim.api.nvim_create_autocmd('VimEnter', {
  callback = function()
    local socket = vim.v.servername
    if socket == '' then return end

    -- Check if symlink exists and points to a valid socket
    local f = io.popen('readlink "' .. socket_link .. '" 2>/dev/null')
    local target = f and f:read('*a'):gsub('%s+$', '') or ''
    if f then f:close() end

    -- If no valid target, auto-pair this instance
    if target == '' or vim.fn.filereadable(target) == 0 then
      vim.cmd('ClaudePair')
    end
  end,
  desc = 'Auto-pair with Claude if no other nvim is paired'
})

return M
