import type { App } from "@modelcontextprotocol/ext-apps";

export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * Call an MCP tool through the host bridge and parse its JSON text result.
 * Our server's `withMcpService` wraps service results as a single
 * `content[]` text entry holding JSON.stringify(data).
 */
export async function callTool<T = unknown>(
  app: App,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = await app.callServerTool({ name, arguments: args });
  const texts =
    result.content
      ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n") ?? "";

  if (result.isError) {
    throw new ToolError(texts || `Tool ${name} failed`);
  }

  if (!texts) return undefined as T;
  try {
    return JSON.parse(texts) as T;
  } catch {
    return texts as unknown as T;
  }
}
