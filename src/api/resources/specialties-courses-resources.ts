import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { courseResults, courses, specialties } from "@/stores/db";

function normalizeTemplateVar(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function registerSpecialtiesCoursesResources(server: McpServer) {
  server.registerResource(
    "specialties",
    "docgen:///specialties",
    {
      title: "Спеціальності",
      description: "Список усіх спеціальностей (/specialties)",
      mimeType: "application/json",
    },
    async (uri) => {
      console.log("MCP resource specialties read", { uri: uri.href });

      const list = await specialties.all();
      const payload = {
        path: "/specialties",
        items: list.map((spec) => ({
          id: spec.id,
          code: spec.code,
          name: spec.name,
          area: spec.area,
          coursesUri: `docgen:///specialty/${spec.id}/courses`,
          coursesPath: `/specialty/${spec.id}/courses`,
          resultsUri: `docgen:///specialty/${spec.id}/results`,
          resultsPath: `/specialty/${spec.id}/results`,
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

  server.registerResource(
    "specialty-courses",
    new ResourceTemplate("docgen:///specialty/{id}/courses", {
      list: async () => {
        const specs = await specialties.all();
        return {
          resources: specs.map((spec) => ({
            uri: `docgen:///specialty/${spec.id}/courses`,
            name: `${spec.code} ${spec.name}`,
            description: `Дисципліни спеціальності (${spec.id})`,
          })),
        };
      },
    }),
    {
      title: "Дисципліни спеціальності",
      description: "Список дисциплін для /specialty/{id}/courses",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const idRaw = normalizeTemplateVar((variables as Record<string, unknown>)?.id) ?? uri.pathname.split("/")[2] ?? null;
      const specialtyId = Number(idRaw);

      console.log("MCP resource specialty-courses read", { uri: uri.href, specialtyId });

      if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Некоректний URI. Очікується /specialty/{id}/courses.",
            },
          ],
        };
      }

      const specialty = await specialties.get(specialtyId);
      if (!specialty) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Спеціальність не знайдено.",
            },
          ],
        };
      }

      const list = await courses.bySpecialty(specialty.id);

      const payload = {
        path: `/specialty/${specialty.id}/courses`,
        specialty: {
          id: specialty.id,
          code: specialty.code,
          name: specialty.name,
        },
        items: list.map((course) => ({
          id: course.id,
          okNo: course.data?.ok_no ?? null,
          name: course.name,
          teacher: course.teacher ?? null,
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

  server.registerResource(
    "specialty-results",
    new ResourceTemplate("docgen:///specialty/{id}/results", {
      list: async () => {
        const specs = await specialties.all();
        return {
          resources: specs.map((spec) => ({
            uri: `docgen:///specialty/${spec.id}/results`,
            name: `${spec.code} ${spec.name}`,
            description: `Результати спеціальності (${spec.id})`,
          })),
        };
      },
    }),
    {
      title: "Результати спеціальності",
      description: "Список результатів для /specialty/{id}/results",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const idRaw = normalizeTemplateVar((variables as Record<string, unknown>)?.id) ?? uri.pathname.split("/")[2] ?? null;
      const specialtyId = Number(idRaw);

      console.log("MCP resource specialty-results read", { uri: uri.href, specialtyId });

      if (!Number.isFinite(specialtyId) || specialtyId <= 0) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Некоректний URI. Очікується /specialty/{id}/results.",
            },
          ],
        };
      }

      const specialty = await specialties.get(specialtyId);
      if (!specialty) {
        return {
          contents: [
            {
              uri: uri.href,
              text: "Спеціальність не знайдено.",
            },
          ],
        };
      }

      const results = await courseResults.bySpecialty(specialty.id);

      const payload = {
        path: `/specialty/${specialty.id}/results`,
        specialty: {
          id: specialty.id,
          code: specialty.code,
          name: specialty.name,
        },
        items: results.map((result) => ({
          id: result.id,
          no: result.no,
          type: result.type,
          name: result.name,
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
