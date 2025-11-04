import { serve } from "bun";

import index from "./index.html";
import teachersApi from "@/api/teachers.ts";
import coursesApi from "@/api/courses.ts";
import generationApi from "@/api/generation.ts";

const server = serve({
  routes: {    
    "/*": index, // Serve index.html for all unmatched routes.        
    ...generationApi,
    ...coursesApi,
    ...teachersApi
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true, // Enable browser hot reloading in development
    console: true, // Echo console logs from the browser to the server
  },
  idleTimeout: 255 // 25 min
});

console.log(`Server is running at ${server.url}`);
