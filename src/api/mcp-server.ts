import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { registerSearchDisciplinesByResult } from "./tools/search-disciplines-by-result";
import { registerSetSpecialty } from "./tools/set-specialty";
import { registerSetActiveCourse } from "./tools/set-course";
import { registerCreateCourse } from "./tools/create-course";
import { registerListSpecialties } from "./tools/list-specialties";
import { registerListCourses } from "./tools/list-courses";
import { registerUpdateCourseTopics } from "./tools/update-course-topics";
import { registerGetCurrentSpecialtyFullInfo } from "./tools/get-current-specialty-full-info";
import { registerGetCurrentCourseFullInfo } from "./tools/get-current-course-full-info";
import { registerUpdateCourseResults } from "./tools/update-course-results";
import { registerUpdateCourseRequisites } from "./tools/update-course-requisites";
import { registerUpdateCourseLiterature } from "./tools/update-course-literature";
import { registerCreateTeacher } from "./tools/create-teacher";
import { registerListTemplates } from "./tools/list-templates";
import { registerListTeachers } from "./tools/list-teachers";
import { registerSpecialtiesCoursesResources } from "./resources/specialties-courses-resources";
import { registerTeachersResources } from "./resources/teachers-resources";
import { registerTemplateManifestResources } from "./resources/template-manifest-resources";
import { registerListTemplateFields } from "./tools/list-template-fields";
import { registerSetTemplateFields } from "./tools/set-template-fields";
import { getInternalPrompt, getInternalPrompts } from "@/ai/internal-prompts";
import { MCP_TOOL_PROMPT_DEFAULTS } from "@/ai/internal-prompts-defaults";

const SERVER_INFO = {
  name: "doc-gen-mcp",
  version: "0.1.0",
};

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

type McpCallback = (...args: any[]) => unknown;

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

function logMcpError(event: string, context: Record<string, unknown>, error: unknown) {
  console.error(`MCP ${event}`, {
    ...context,
    error: errorDetails(error),
  });
}

function addCallbackErrorLogging(server: McpServer) {
  const registerTool: any = server.registerTool.bind(server);
  server.registerTool = ((name: string, config: any, callback: McpCallback) =>
    registerTool(name, config, async (...args: any[]) => {
      try {
        return await callback(...args);
      } catch (error) {
        const context = args[1] as { sessionId?: string } | undefined;
        logMcpError("tool failed", { tool: name, sessionId: context?.sessionId }, error);
        throw error;
      }
    })) as typeof server.registerTool;

  const registerResource: any = server.registerResource.bind(server);
  server.registerResource = ((name: string, uriOrTemplate: any, config: any, callback: McpCallback) =>
    registerResource(name, uriOrTemplate, config, async (...args: any[]) => {
      try {
        return await callback(...args);
      } catch (error) {
        const uri = args[0] instanceof URL ? args[0].href : undefined;
        logMcpError("resource read failed", { resource: name, uri }, error);
        throw error;
      }
    })) as typeof server.registerResource;
}

function addToolDescriptionOverrides(server: McpServer, descriptions: Map<string, string>) {
  const registerTool: any = server.registerTool.bind(server);
  server.registerTool = ((name: string, config: any, callback: McpCallback) =>
    registerTool(name, {
      ...config,
      description: descriptions.get(`mcp.tool.${name}`) ?? config.description,
    }, callback)) as typeof server.registerTool;
}

async function createServer(transport: WebStandardStreamableHTTPServerTransport): Promise<McpServer> {
  const [instructions, prompts] = await Promise.all([
    getInternalPrompt("mcp.instructions"),
    getInternalPrompts(MCP_TOOL_PROMPT_DEFAULTS.map((prompt) => prompt.key)),
  ]);
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
      logging: {}
    },
    instructions: instructions.text,
  });

  addCallbackErrorLogging(server);
  addToolDescriptionOverrides(server, new Map(Array.from(prompts.values()).map((prompt) => [prompt.key, prompt.text])));
  server.server.onerror = (error) => {
    logMcpError("protocol error", { sessionId: transport.sessionId }, error);
  };

  registerSearchDisciplinesByResult(server);
  registerListCourses(server);
  registerSetSpecialty(server);
  registerSetActiveCourse(server);
  registerCreateCourse(server);
  registerListSpecialties(server);
  registerUpdateCourseTopics(server);
  registerGetCurrentSpecialtyFullInfo(server);
  registerGetCurrentCourseFullInfo(server);
  registerUpdateCourseResults(server);
  registerUpdateCourseRequisites(server);
  registerUpdateCourseLiterature(server);
  registerCreateTeacher(server);
  registerListTemplates(server);
  registerListTemplateFields(server);
  registerSetTemplateFields(server);
  registerListTeachers(server);
  registerSpecialtiesCoursesResources(server);
  registerTeachersResources(server);
  registerTemplateManifestResources(server);

  return server;
}

export async function handleMcpRequest(req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");
  const requestContext = {
    method: req.method,
    path: new URL(req.url).pathname,
    sessionId,
  };

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

    try {
      const server = await createServer(transport);
      await server.connect(transport);
    } catch (error) {
      logMcpError("server initialization failed", requestContext, error);
      throw error;
    }
  }

  try {
    return await transport.handleRequest(req);
  } catch (error) {
    logMcpError("request failed", { ...requestContext, transportSessionId: transport.sessionId }, error);
    throw error;
  }
}

const mcpApi = {
  "/mcp": handleMcpRequest,
};

export default mcpApi;
