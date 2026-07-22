import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { templates } from "@/stores/db";
import { buildTemplateManifest } from "@/services/template-fields-service";

function normalizeTemplateVar(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function registerTemplateManifestResources(server: McpServer) {
  server.registerResource(
    "template-manifest",
    new ResourceTemplate("docgen:///template/{id}/manifest", {
      list: async () => {
        const list = await templates.all();
        return {
          resources: list.map((template) => ({
            uri: `docgen:///template/${template.id}/manifest`,
            name: template.name,
            description: `Контракт полів шаблону «${template.name}»`,
          })),
        };
      },
    }),
    {
      title: "Маніфест шаблону",
      description: "Параметри, AI-поля, схеми результатів і залежності шаблону",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const idRaw = normalizeTemplateVar((variables as Record<string, unknown>)?.id)
        ?? uri.pathname.split("/")[2]
        ?? null;
      const templateId = Number(idRaw);

      console.log("MCP resource template-manifest read", { uri: uri.href, templateId });

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return { contents: [{ uri: uri.href, text: "Некоректний URI маніфесту шаблону." }] };
      }
      const template = await templates.get(templateId);
      if (!template) {
        return { contents: [{ uri: uri.href, text: "Шаблон не знайдено." }] };
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(buildTemplateManifest(template)),
        }],
      };
    },
  );
}
