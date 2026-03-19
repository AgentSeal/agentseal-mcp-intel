#!/usr/bin/env node
/**
 * agentseal-mcp-intel — Entry point
 *
 * Connects the AgentSeal MCP server to stdio transport so that
 * Claude Desktop, Cursor, Windsurf, and other MCP-compatible hosts
 * can communicate with it via JSON-RPC over stdin/stdout.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAgentSealServer } from "./server.js";

const server = createAgentSealServer();
const transport = new StdioServerTransport();

await server.connect(transport);
