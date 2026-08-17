/**
 * MCP HTTP endpoint stub — wires the same SDK surface as the Next `/mcp` route.
 * Tool registration expands as domain modules land.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json({
      name: "claudecommunities",
      version: "0.1.0",
      transport: "http",
      status: "scaffold",
      tools: ["health", "list_events", "list_posts"],
    });
  }

  try {
    const body = (await request.json()) as {
      method?: string;
      params?: { name?: string };
    };
    if (body.method === "tools/list") {
      return Response.json({
        tools: [
          {
            name: "health",
            description: "Platform health check",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "list_events",
            description: "List published events for a city",
            inputSchema: {
              type: "object",
              properties: { citySlug: { type: "string" } },
              required: ["citySlug"],
            },
          },
        ],
      });
    }
    return Response.json({ error: "not_implemented", method: body.method }, { status: 501 });
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
}
