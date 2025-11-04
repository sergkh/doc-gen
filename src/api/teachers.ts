import { teachers } from "@/stores/db";

const teachersApi = {
  "/api/teachers": {
      async GET() {
        console.log("Fetching all teachers");
        return Response.json(await teachers.all());
      }
  }
};

export default teachersApi;