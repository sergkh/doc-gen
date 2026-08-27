import type {
  AddedDelta,
  DeletedDelta,
  Delta,
  ModifiedDelta,
  MovedDelta,
  TextDiffDelta,
} from "jsondiffpatch";

export type CourseFieldChangeKind = "added" | "removed" | "modified" | "moved" | "text";

export type CourseFieldChange = {
  path: string;
  kind: CourseFieldChangeKind;
  before?: unknown;
  after?: unknown;
};

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  name: "Назва",
  teacher_id: "Викладач",
  teacher: "Ім’я викладача",
  specialty_id: "Спеціальність",
  data: "Дані курсу",
  generated: "Згенеровані матеріали",
  disciplineQuestions: "Питання з дисципліни",
  selfMethodGoal: "Мета методичних рекомендацій",
  selfMethodTask: "Завдання методичних рекомендацій",
  selfMethodGeneral: "Загальні положення методичних рекомендацій",
  selfMethodIndividualTopics: "Теми індивідуальної роботи",
  programGoal: "Мета програми",
  programTask: "Завдання програми",
  programSubject: "Предмет програми",
  programOrientation: "Орієнтація програми",
  programBriefResults: "Очікувані результати програми",
  programBriefSkills: "Очікувані навички",
  programIntro: "Вступ до програми",
  programBriefIntro: "Короткий вступ до програми",
  topics: "Теми",
  version: "Версія",
  ok_no: "Номер ОК",
  practice_type: "Тип практичних занять",
  optional: "Вибіркова дисципліна",
  type: "Тип",
  control_type: "Форма контролю",
  hours: "Години",
  hours_detailed: "Деталізація годин",
  practical_hours: "Практичні години",
  lab_hours: "Лабораторні години",
  srs_hours: "Години самостійної роботи",
  total_hours: "Загальна кількість годин",
  credits: "Кредити",
  specialty_mode: "Режим спеціальності",
  specialty: "Назва спеціальності",
  specialty_full: "Дані спеціальності",
  area: "Галузь знань",
  description: "Опис",
  prerequisites: "Пререквізити",
  postrequisites: "Постреквізити",
  results: "Результати навчання",
  attestations: "Атестації",
  semester: "Семестр",
  fulltime: "Денна форма",
  inabscentia: "Заочна форма",
  study_year: "Рік навчання",
  literature: "Література",
  main: "Основна",
  additional: "Додаткова",
  internet: "Інтернет-ресурси",
  method: "Методичні матеріали",
  warnings: "Попередження",
  index: "Порядковий номер",
  lection: "Лекційний матеріал",
  attestation: "Атестація",
  practices: "Практичні роботи",
};

const SPECIALTY_FIELD_LABELS: Record<string, string> = {
  id: "ID",
  code: "Код спеціальності",
  name: "Назва спеціальності",
  old_code: "Попередній код спеціальності",
  old_name: "Попередня назва спеціальності",
  area_code: "Код галузі знань",
  area: "Галузь знань",
  degree: "Рівень освіти",
  qualification: "Кваліфікація",
  data: "Дані спеціальності",
  disciplines: "Дисципліни",
  ok_no: "Номер ОК",
  credits: "Кредити",
  control_type: "Форма контролю",
};

function appendPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function appendIndex(path: string, index: number): string {
  return `${path}[${index + 1}]`;
}

type DeltaTuple = AddedDelta | ModifiedDelta | DeletedDelta | MovedDelta | TextDiffDelta;

function isDeltaTuple(delta: Delta): delta is DeltaTuple {
  return Array.isArray(delta);
}

function visitDelta(delta: Delta, path: string, changes: CourseFieldChange[]) {
  if (!delta) return;

  if (isDeltaTuple(delta)) {
    if (delta.length === 1) {
      changes.push({ path, kind: "added", after: delta[0] });
    } else if (delta.length === 2) {
      changes.push({ path, kind: "modified", before: delta[0], after: delta[1] });
    } else if (delta[2] === 0) {
      changes.push({ path, kind: "removed", before: delta[0] });
    } else if (delta[2] === 2) {
      changes.push({ path, kind: "text", after: delta[0] });
    } else if (delta[2] === 3) {
      changes.push({
        path,
        kind: "moved",
        before: Number(path.match(/\[(\d+)\]$/)?.[1] ?? 0),
        after: Number(delta[1]) + 1,
      });
    }
    return;
  }

  const objectDelta = delta as Record<string, Delta>;
  const isArrayDelta = (objectDelta as Record<string, unknown>)._t === "a";

  const entries = Object.entries(objectDelta);
  if (isArrayDelta) {
    entries.sort(([left], [right]) => {
      const operationOrder = Number(right.startsWith("_")) - Number(left.startsWith("_"));
      if (operationOrder !== 0) return operationOrder;
      return Number(left.replace("_", "")) - Number(right.replace("_", ""));
    });
  }

  for (const [key, childDelta] of entries) {
    if (key === "_t") continue;

    if (isArrayDelta) {
      const removedOrMoved = key.startsWith("_");
      const rawIndex = removedOrMoved ? key.slice(1) : key;
      const index = Number(rawIndex);

      if (Number.isInteger(index)) {
        visitDelta(childDelta, appendIndex(path, index), changes);
      }
      continue;
    }

    visitDelta(childDelta, appendPath(path, key), changes);
  }
}

export function getHistoryFieldChanges(delta: Delta): CourseFieldChange[] {
  const changes: CourseFieldChange[] = [];
  visitDelta(delta, "", changes);
  return changes;
}

export const getCourseFieldChanges = getHistoryFieldChanges;

function formatFieldPath(path: string, rootLabel: string, labels: Record<string, string>): string {
  if (!path) return rootLabel;
  const parts = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)];
  return parts
    .map((part) => {
      if (part[2]) return `№ ${part[2]}`;
      const key = part[1]!;
      return labels[key] ?? key;
    })
    .join(" › ");
}

export function formatCourseFieldPath(path: string): string {
  return formatFieldPath(path, "Курс", FIELD_LABELS);
}

export function formatSpecialtyFieldPath(path: string): string {
  return formatFieldPath(path, "Спеціальність", SPECIALTY_FIELD_LABELS);
}

export function formatHistoryChangeValue(value: unknown): string {
  if (typeof value === "undefined" || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Так" : "Ні";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  return JSON.stringify(value, null, 2);
}

export const formatCourseChangeValue = formatHistoryChangeValue;
