import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { registerSearchDisciplinesByResult } from "./tools/search-disciplines-by-result";
import { registerSetSpecialty } from "./tools/set-specialty";
import { registerSetActiveCourse } from "./tools/set-course";
import { registerCreateCourse } from "./tools/create-course";
import { registerListSpecialties } from "./tools/list-specialties";
import { registerListCourses } from "./tools/list-courses";
import { registerUpdateCourseTopics } from "./tools/update-course-topics";

const SERVER_INFO = {
  name: "doc-gen-mcp",
  version: "0.1.0",
};

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

const server = new McpServer(SERVER_INFO, {
  capabilities: {
    tools: {},
    logging: {}
  },
  instructions:
    `MCP сервер для роботи з навчальними планами та дисциплінами. Використовуй надані інструменти та відповідай українською.
    Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані.
    Перед початком роботи необхідно запитати з якою спеціальністю працюємо й встанови її через set_specialty_context.
    Контекст сесії: set_specialty_context, set_course_context. Інші інструменти використовують спеціальність чи курс з контексту.
    Доступні інструменти:
    - set_specialty_context (встановлює активну спеціальність)
    - set_course_context (встановлює активну курс/дисципліну)
    - search_disciplines_by_result (пошук курсів за результатом)
    - list_courses (список курсів за specialtyId)
    - list_specialties (список спеціальностей і кодів)
    - create_course (створення курсу для поточної спеціальності; потребує підтвердження користувача, робить дисципліну активною після створення)
    - update_course_topics (оновлення тем активної дисципліни; потребує confirm=true)
    `
});

registerSearchDisciplinesByResult(server);
registerListCourses(server);
registerSetSpecialty(server);
registerSetActiveCourse(server);
registerCreateCourse(server);
registerListSpecialties(server);
registerUpdateCourseTopics(server);

export async function handleMcpRequest(req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");

  let transport: WebStandardStreamableHTTPServerTransport;

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!;
  } else {
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized(id) {
        transports.set(id, transport);
      },
      onsessionclosed(id) {
        transports.delete(id);
      },
    });

    await server.connect(transport);
  }

  return transport.handleRequest(req);
}

const mcpApi = {
  "/mcp": handleMcpRequest,
};

export default mcpApi;