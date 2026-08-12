import type { BunRequest } from "bun";

const scheduleApiBase = "https://mkr.sergkh.com";

const proxyJson = async (path: string, query?: URLSearchParams) => {
  const url = new URL(path, scheduleApiBase);

  if (query) {
    for (const [key, value] of query) url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};

const parseId = (value: string) => {
  if (!/^\d+$/.test(value)) throw new Response("Invalid numeric path parameter", { status: 400 });
  return value;
};

const withProxyErrors = async (run: () => Promise<Response>) => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response(error instanceof Error ? error.message : "Schedule API request failed", { status: 502 });
  }
};

const workHoursApi = {
  "/api/work-hours/structures/:structureId/chairs": {
    async GET(req: BunRequest) {
      const { structureId } = req.params as { structureId: string };
      return withProxyErrors(() => proxyJson(`/structures/${parseId(structureId)}/chairs`));
    },
  },
  "/api/work-hours/structures/:structureId/chairs/:chairId/teachers": {
    async GET(req: BunRequest) {
      const { structureId, chairId } = req.params as { structureId: string; chairId: string };
      return withProxyErrors(() => proxyJson(`/structures/${parseId(structureId)}/chairs/${parseId(chairId)}/teachers`));
    },
  },
  "/api/work-hours/structures/:structureId/chairs/:chairId/teachers/:teacherId/schedule": {
    async GET(req: BunRequest) {
      return withProxyErrors(() => {
        const { structureId, chairId, teacherId } = req.params as { structureId: string; chairId: string; teacherId: string };
        return proxyJson(
          `/structures/${parseId(structureId)}/chairs/${parseId(chairId)}/teachers/${parseId(teacherId)}/schedule`,
          new URL(req.url).searchParams,
        );
      });
    },
  },
};

export default workHoursApi;
