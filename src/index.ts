#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getBufferInfo,
  setBufferContent,
  getEditorContext,
  executeCommand,
  executeLua,
  navigateToFile,
  isConnected,
} from './neovim-client.js';

const server = new McpServer({
  name: 'nvim-bridge',
  version: '1.0.0',
});

// Tool: Get buffer contents
server.tool(
  'nvim_get_buffer',
  {
    includeLineNumbers: z.boolean().optional().describe('Include line numbers in output (default: true)'),
    startLine: z.number().optional().describe('Start line (1-indexed, optional)'),
    endLine: z.number().optional().describe('End line (1-indexed, optional)'),
  },
  async (args) => {
    try {
      const info = await getBufferInfo(
        args.startLine,
        args.endLine,
        args.includeLineNumbers !== false
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'neovim_not_connected',
              message: error instanceof Error ? error.message : 'Unknown error',
              suggestion: 'Start Neovim with: nvim --listen /tmp/nvim-$USER.sock <file>',
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Set buffer contents
server.tool(
  'nvim_set_buffer',
  {
    content: z.string().describe('New buffer content (required)'),
    startLine: z.number().optional().describe('Start line for partial replacement (1-indexed, optional)'),
    endLine: z.number().optional().describe('End line for partial replacement (1-indexed, optional)'),
  },
  async (args) => {
    try {
      const result = await setBufferContent(
        args.content,
        args.startLine,
        args.endLine
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, ...result }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'failed_to_set_buffer',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Get editor context
server.tool(
  'nvim_get_context',
  {},
  async () => {
    try {
      const context = await getEditorContext();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'neovim_not_connected',
              message: error instanceof Error ? error.message : 'Unknown error',
              suggestion: 'Start Neovim with: nvim --listen /tmp/nvim-$USER.sock <file>',
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Execute command
server.tool(
  'nvim_execute',
  {
    command: z.string().optional().describe('Vim command (without leading ":")'),
    lua: z.string().optional().describe('Lua code to execute (alternative to command)'),
  },
  async (args) => {
    try {
      let output: unknown;
      if (args.lua) {
        output = await executeLua(args.lua);
      } else if (args.command) {
        output = await executeCommand(args.command);
      } else {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide command or lua' }) }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, output }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'execution_failed',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Navigate to file
server.tool(
  'nvim_navigate',
  {
    path: z.string().describe('File path to open (required)'),
    line: z.number().optional().describe('Line number to jump to (optional)'),
    column: z.number().optional().describe('Column number (optional)'),
  },
  async (args) => {
    try {
      await navigateToFile(args.path, args.line, args.column);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, openedPath: args.path }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'navigation_failed',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: Check connection status
server.tool(
  'nvim_status',
  {},
  async () => {
    const connected = await isConnected();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            connected,
            message: connected
              ? 'Neovim is connected and ready'
              : 'Neovim is not connected. Start with: nvim --listen /tmp/nvim-$USER.sock <file>',
          }),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('nvim-bridge MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
