#!/usr/bin/env node
const readline = require('readline');
const pkg = require('../package.json');
const ProviderManager = require('./provider-manager');

const manager = new ProviderManager();

const SERVER_NAME = 'proxy-lite-mcp';
const SERVER_VERSION = pkg.version;

const TOOLS = [
  {
    name: 'ask_provider',
    description: 'Send a prompt or instructions to an external LLM provider (e.g. gemini-3.8-flash-high, claude-sonnet-4-6, etc.) using custom API endpoint and API key.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The user query, prompt, or instruction to execute.'
        },
        system_prompt: {
          type: 'string',
          description: 'Optional system prompt/context for the model.'
        },
        model: {
          type: 'string',
          description: 'Specific model to use (e.g. gemini-3.8-flash-high, claude-sonnet-4-6). Defaults to the active provider default model.'
        },
        provider_id: {
          type: 'string',
          description: 'Optional provider ID to route the prompt to (e.g. cliproxy-nalarin). Defaults to active provider.'
        },
        temperature: {
          type: 'number',
          description: 'Sampling temperature between 0.0 and 2.0 (default 0.7).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'list_providers',
    description: 'List all configured external API providers, their endpoints, default models, and which one is active.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'set_active_provider',
    description: 'Switch the active provider and optionally change its default model.',
    inputSchema: {
      type: 'object',
      properties: {
        provider_id: {
          type: 'string',
          description: 'The ID of the provider to make active.'
        },
        model: {
          type: 'string',
          description: 'Optional model to set as default for this provider.'
        }
      },
      required: ['provider_id']
    }
  },
  {
    name: 'list_provider_models',
    description: 'Fetch the real-time list of available models from the provider endpoint via /v1/models.',
    inputSchema: {
      type: 'object',
      properties: {
        provider_id: {
          type: 'string',
          description: 'Optional provider ID (defaults to active provider).'
        }
      }
    }
  },
  {
    name: 'add_provider',
    description: 'Register a new external LLM provider by providing its API endpoint and API key.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Display name for the provider (e.g. DeepSeek, OpenRouter, Local Ollama).'
        },
        endpoint: {
          type: 'string',
          description: 'API endpoint URL (e.g. https://api.deepseek.com/v1).'
        },
        apiKey: {
          type: 'string',
          description: 'API Key or bearer token.'
        },
        defaultModel: {
          type: 'string',
          description: 'Default model name to use with this provider.'
        }
      },
      required: ['name', 'endpoint', 'apiKey']
    }
  },
  {
    name: 'test_provider_connection',
    description: 'Test connectivity and latency to an external API endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Optional endpoint URL to test (defaults to active provider).'
        },
        apiKey: {
          type: 'string',
          description: 'Optional API key to test (defaults to active provider).'
        }
      }
    }
  },
  {
    name: 'get_version',
    description: 'Get the current version, running environment, active provider, and operational status of Proxy-Lite.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

function sendResponse(id, result, error = null) {
  const payload = { jsonrpc: '2.0', id };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  const jsonStr = JSON.stringify(payload);
  process.stdout.write(jsonStr + '\n');
}

async function handleToolCall(name, args) {
  manager.ensureFreshConfig();
  try {
    switch (name) {
    case 'ask_provider': {
      const { prompt, system_prompt, model, provider_id, temperature } = args || {};
      const res = await manager.chatCompletion({
        providerId: provider_id,
        model,
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: system_prompt,
        temperature: temperature ?? 0.7
      });

      const text = res?.choices?.[0]?.message?.content || JSON.stringify(res);
      const usedModel = res?.model || model || 'default';
      return {
        content: [
          {
            type: 'text',
            text: `[Model: ${usedModel}]\n\n${text}`
          }
        ]
      };
    }

    case 'list_providers': {
      const providers = manager.getProviders(true);
      const active = manager.getActiveProvider();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              activeProviderId: active?.id,
              providers
            }, null, 2)
          }
        ]
      };
    }

    case 'set_active_provider': {
      const { provider_id, model } = args || {};
      const updated = manager.setActiveProvider(provider_id, model);
      return {
        content: [
          {
            type: 'text',
            text: `Active provider set to: ${updated.name} (${updated.id}) with default model: ${updated.defaultModel}`
          }
        ]
      };
    }

    case 'list_provider_models': {
      const { provider_id } = args || {};
      const models = await manager.fetchModels(provider_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: models.length, models }, null, 2)
          }
        ]
      };
    }

    case 'add_provider': {
      const created = manager.addOrUpdateProvider(args);
      return {
        content: [
          {
            type: 'text',
            text: `Provider '${created.name}' (${created.id}) registered successfully with endpoint: ${created.endpoint}`
          }
        ]
      };
    }

    case 'test_provider_connection': {
      let { endpoint, apiKey } = args || {};
      if (!endpoint || !apiKey) {
        const active = manager.getActiveProvider();
        if (active) {
          endpoint = endpoint || active.endpoint;
          apiKey = apiKey || active.apiKey;
        }
      }
      if (!endpoint || !apiKey) {
        throw new Error('Endpoint and apiKey are required for test');
      }
      const testRes = await manager.testConnection(endpoint, apiKey);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(testRes, null, 2)
          }
        ]
      };
    }

    case 'get_version': {
      const active = manager.getActiveProvider();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: pkg.name,
              version: pkg.version,
              activeProvider: active ? {
                id: active.id,
                name: active.name,
                defaultModel: active.defaultModel
              } : null,
              nodeVersion: process.version,
              platform: process.platform,
              uptimeSec: Math.floor(process.uptime()),
              protocolVersion: '2024-11-05'
            }, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `[Proxy-Lite Error] ${err.message}`
        }
      ]
    };
  }
}

async function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        }
      });
      break;

    case 'notifications/initialized':
      // Client notification, no response required
      break;

    case 'ping':
      sendResponse(id, {});
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      try {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const result = await handleToolCall(toolName, toolArgs);
        sendResponse(id, result);
      } catch (err) {
        sendResponse(id, null, {
          code: -32603,
          message: err.message
        });
      }
      break;
    }

    default:
      if (id !== undefined) {
        sendResponse(id, null, {
          code: -32601,
          message: `Method '${method}' not implemented`
        });
      }
      break;
  }
}

function start() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      handleMessage(msg).catch(err => {
        console.error('[MCP Error]', err);
      });
    } catch (err) {
      console.error('[MCP Parse Error] Invalid JSON:', trimmed);
    }
  });

  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
}

start();
