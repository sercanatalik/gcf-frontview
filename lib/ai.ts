import { createOpenAI } from "@ai-sdk/openai";

export const litellm = createOpenAI({
  baseURL: process.env.LITELLM_BASE_URL || "http://localhost:4000/v1",
  apiKey: process.env.LITELLM_API_KEY || "",
});

export const AI_MODEL = process.env.LITELLM_MODEL || "gpt-4o";

export const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "http://gcf-mcp.dev";
