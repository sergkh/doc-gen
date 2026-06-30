import { McpServer } from "@modelcontextprotocol/server";
import { teachers } from "@/stores/db";

export function registerTeachersResources(server: McpServer) {
  server.registerResource(
    "teachers",
    "docgen:///teachers",
    {
      title: "Викладачі",
      description: "Список усіх викладачів (/teachers)",
      mimeType: "application/json",
    },
    async (uri) => {
      console.log("MCP resource teachers read", { uri: uri.href });

      const all = await teachers.all();
      const payload = {
        path: "/teachers",
        items: all.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          position: t.position,
          academic_title: t.academic_title,
          alt_names: t.alt_names,
        })),
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload),
          },
        ],
      };
    }
  );
}
