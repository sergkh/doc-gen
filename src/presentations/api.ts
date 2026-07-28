import type { BunRequest } from "bun";
import {
  PresentationAlreadyExistsError,
  PresentationConflictError,
  PresentationDirtyError,
  PresentationNotFoundError,
  PresentationValidationError,
  type SlideOperation,
} from "./models";
import { presentationService } from "./service";

type CourseTopicParams = { courseId: string; topicUid: string };

function identifiers(params: CourseTopicParams): { courseId: number; topicUid: string } {
  const courseId = Number(params.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) throw new PresentationValidationError("Некоректний ID курсу.");
  return { courseId, topicUid: params.topicUid };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Невідома помилка.";
  if (error instanceof PresentationConflictError) {
    return Response.json({ error: message, currentRevision: error.currentRevision }, { status: 409 });
  }
  if (error instanceof PresentationAlreadyExistsError || error instanceof PresentationDirtyError) {
    return Response.json({ error: message }, { status: 409 });
  }
  if (error instanceof PresentationNotFoundError) {
    return Response.json({ error: message }, { status: 404 });
  }
  if (error instanceof PresentationValidationError) {
    return Response.json({ error: message }, { status: 400 });
  }
  console.error("Presentation API error", error);
  return Response.json({ error: message }, { status: 500 });
}

const presentationApi = {
  "/api/presentations/courses/:courseId": {
    async GET(req: BunRequest) {
      try {
        const courseId = Number((req.params as { courseId: string }).courseId);
        return Response.json(await presentationService.listCoursePresentations(courseId));
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid": {
    async GET(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        return Response.json(await presentationService.getPresentation(courseId, topicUid));
      } catch (error) {
        return errorResponse(error);
      }
    },
    async POST(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json().catch(() => ({})) as {
          title?: string;
          theme?: string;
          slides?: string[];
        };
        return Response.json(
          await presentationService.createPresentation(courseId, topicUid, body),
          { status: 201 },
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/slides": {
    async PUT(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json() as { baseRevision: string; slides: string[] };
        return Response.json(
          await presentationService.replacePresentationSlides(
            courseId,
            topicUid,
            body.baseRevision,
            body.slides,
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/slides/operations": {
    async POST(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json() as { baseRevision: string; operations: SlideOperation[] };
        return Response.json(
          await presentationService.updatePresentationSlides(
            courseId,
            topicUid,
            body.baseRevision,
            body.operations,
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/preview": {
    async POST(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json() as { slideIndex: number; markdown?: string };
        return Response.json(
          await presentationService.previewPresentationSlide(
            courseId,
            topicUid,
            body.slideIndex,
            body.markdown,
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/diagrams": {
    async PUT(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json() as {
          baseRevision: string;
          name: string;
          type: string;
          source: string;
          alt?: string;
        };
        return Response.json(
          await presentationService.putPresentationDiagram(courseId, topicUid, body.baseRevision, body),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/diagrams/:fileName": {
    async GET(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const fileName = decodeURIComponent((req.params as CourseTopicParams & { fileName: string }).fileName);
        const file = await presentationService.readDiagramFile(courseId, topicUid, fileName);
        const type = fileName.endsWith(".svg")
          ? "image/svg+xml"
          : fileName.endsWith(".json")
            ? "application/json"
            : "text/plain; charset=utf-8";
        return new Response(file, {
          headers: {
            "Content-Type": type,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
            "Cache-Control": "no-cache",
          },
        });
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/history": {
    async GET(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        return Response.json(await presentationService.getPresentationHistory(courseId, topicUid));
      } catch (error) {
        return errorResponse(error);
      }
    },
  },

  "/api/presentations/courses/:courseId/topics/:topicUid/history/restore": {
    async POST(req: BunRequest) {
      try {
        const { courseId, topicUid } = identifiers(req.params as CourseTopicParams);
        const body = await req.json() as {
          baseRevision: string;
          revision: string;
          confirm: boolean;
        };
        if (!body.confirm) {
          throw new PresentationValidationError("Для відновлення потрібно передати confirm=true.");
        }
        return Response.json(
          await presentationService.restorePresentation(
            courseId,
            topicUid,
            body.baseRevision,
            body.revision,
          ),
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  },
};

export default presentationApi;

