import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { litellm, AI_MODEL, MCP_SERVER_URL } from "@/lib/ai";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const mcpClient = await createMCPClient({
    transport: { type: "sse", url: MCP_SERVER_URL },
  });

  const tools = await mcpClient.tools();

  const result = streamText({
    model: litellm(AI_MODEL),
    system:
      "You are a helpful data analysis assistant for GCF Frontview. Be concise and precise. Use the available tools when relevant to answer questions.",
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      await mcpClient.close();
    },
  });

  return result.toUIMessageStreamResponse();
}
