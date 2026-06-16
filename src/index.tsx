import { serve } from "bun";

import index from "./index.html";
import teachersApi from "@/api/teachers-api.ts";
import coursesApi from "@/api/courses-api.ts";
import generationApi from "@/api/generation-api.ts";
import resultsApi from "@/api/results-api.ts";
import templatesApi from "@/api/templates-api.ts";
import specialtiesApi from "@/api/specialties-api.ts";
import chatApi from "@/api/chat-api.ts";
import { chatWebsocket } from "@/api/chat-api.ts";
import { NotFoundError } from "openai";

const routes = {    
  "/*": index, // Serve index.html for all unmatched routes.        
  ...generationApi,
  ...coursesApi,
  ...teachersApi,
  ...resultsApi,
  ...templatesApi,
  ...specialtiesApi,
  ...chatApi
};

const server = serve({
  routes: routes,
  websocket: chatWebsocket,

  development: process.env.NODE_ENV !== "production" && {
    hmr: true, // Enable browser hot reloading in development
    console: true, // Echo console logs from the browser to the server
  },
  error(error) {
    console.log("Failed to process request:", error);
    if (error instanceof NotFoundError) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(error.message, { status: 500 });
  },
  idleTimeout: 255 // 25 min
});

console.log(`Server is running at ${server.url}`);