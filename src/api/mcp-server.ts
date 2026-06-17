import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { registerSearchDisciplinesByResult } from "./tools/search-disciplines-by-result";
import { registerListDisciplines } from "./tools/list-disciplines";
import { registerSetSpecialty } from "./tools/set-specialty";
import { registerSetDiscipline } from "./tools/set-discipline";

const SERVER_INFO = {
  name: "doc-gen-mcp",
  version: "0.1.0",
};

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,
});

const server = new McpServer(SERVER_INFO, {
  capabilities: {
    tools: {},
  },
  instructions:
    `MCP сервер для роботи з навчальними планами та дисциплінами. Використовуй надані інструменти та відповідай українською.
    Якщо інструмент повертає помилку або бракує параметрів, попроси користувача уточнити дані.
    Контекст сесії: set_specialty_context, set_discipline_context. Інші інструменти використовують specialtyId/discipline з контексту, якщо не передано.
    Доступні інструменти:
    - set_specialty_context (встановлює спеціальність для сесії)
    - set_discipline_context (встановлює дисципліну для сесії)
    - search_disciplines_by_result (пошук курсів за результатом)
    - list_disciplines (список курсів за specialtyId)
    `
});

registerSearchDisciplinesByResult(server);
registerListDisciplines(server);
registerSetSpecialty(server);
registerSetDiscipline(server);

const connectPromise = server.connect(transport);

export async function handleMcpRequest(req: Request): Promise<Response> {
  await connectPromise;
  return transport.handleRequest(req);
}

const mcpApi = {
  "/mcp": handleMcpRequest,
};

export default mcpApi;