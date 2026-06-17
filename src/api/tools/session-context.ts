export type SessionDiscipline = {
  id: number;
  name?: string | null;
  okNo?: string | null;
  teacher?: string | null;
};

export type SessionContext = {
  specialtyId?: number;
  discipline?: SessionDiscipline;
};

const sessionContexts = new Map<string, SessionContext>();

function getOrInit(sessionId: string | undefined): SessionContext {
  const key = sessionId ?? "anonymous";
  const existing = sessionContexts.get(key);
  if (existing) return existing;
  const ctx: SessionContext = {};
  sessionContexts.set(key, ctx);
  return ctx;
}

export function getSessionContext(sessionId: string | undefined): SessionContext {
  return getOrInit(sessionId);
}

export function setSessionSpecialty(sessionId: string | undefined, specialtyId: number) {
  const ctx = getOrInit(sessionId);
  ctx.specialtyId = specialtyId;
}

export function setSessionDiscipline(sessionId: string | undefined, discipline: SessionDiscipline | null) {
  const ctx = getOrInit(sessionId);
  ctx.discipline = discipline ?? undefined;
}