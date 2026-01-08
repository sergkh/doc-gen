import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import type { Course, CourseResult, Specialty, SpecialtyDisciplineConfig } from "@/stores/models";
import { loadAllSpecialties, loadSpecialty } from "../specialties";
import { loadResultsBySpecialty } from "../results";
import { loadAllCourses } from "../courses";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності",
  "РН": "Результати навчання"
} as const;

type ResultType = keyof typeof RESULT_TYPES;
const RESULT_TYPE_ORDER: ResultType[] = ["ЗК", "СК", "РН"];

type ExtendedDiscipline = SpecialtyDisciplineConfig & {
  id?: number | string;
  code?: string;
  ok_no?: string | number;
};

type MatrixRow = {
  discipline: ExtendedDiscipline;
  normalizedOkNo: string | null;
  displayCode: string;
  course: Course | null;
};

function normalizeOkNo(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = typeof value === "number" ? value.toString() : value;
  const cleaned = normalized
    .replace(/[,]/g, ".")
    .replace(/\s+/g, "")
    .replace(/^[ОOВB][КK]/i, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match || !match[1]) return null;
  const trimmed = match[1].replace(/\.$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function formatDisciplineCode(discipline: ExtendedDiscipline, normalized: string | null): string {
  const rawCode = discipline.code ?? discipline.id ?? discipline.ok_no;
  if (rawCode !== undefined && rawCode !== null) {
    const rawString = String(rawCode).trim();
    if (rawString.length > 0) return rawString;
  }
  return normalized ? `ОК${normalized}` : "—";
}

function formatResultCode(result: CourseResult): string {
  return `${result.type ?? ""}${result.no}`;
}

export default function ResultsMatrix() {
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingSpecialty, setIsLoadingSpecialty] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  useEffect(() => {
    loadAllSpecialties()
      .then(setSpecialties)
      .catch((error) => {
        console.error("Error loading specialties", error);
        toast.error("Не вдалося завантажити спеціальності");
      });
  }, []);

  useEffect(() => {
    setIsLoadingCourses(true);
    loadAllCourses()
      .then(setCourses)
      .catch((error) => {
        console.error("Error loading courses", error);
        toast.error("Не вдалося завантажити дисципліни");
      })
      .finally(() => setIsLoadingCourses(false));
  }, []);

  useEffect(() => {
    if (selectedSpecialtyId === null) {
      setSelectedSpecialty(null);
      setResults([]);
      return;
    }

    setIsLoadingSpecialty(true);
    Promise.all([
      loadSpecialty(String(selectedSpecialtyId)),
      loadResultsBySpecialty(selectedSpecialtyId)
    ])
      .then(([specialty, specialtyResults]) => {
        setSelectedSpecialty(specialty);
        setResults(specialtyResults);
      })
      .catch((error) => {
        console.error("Error loading specialty data", error);
        toast.error("Не вдалося завантажити дані спеціальності");
        setSelectedSpecialty(null);
        setResults([]);
      })
      .finally(() => setIsLoadingSpecialty(false));
  }, [selectedSpecialtyId]);

  const disciplineRows: MatrixRow[] = useMemo(() => {
    const specialtyDisciplines = (selectedSpecialty?.data?.disciplines ?? []) as ExtendedDiscipline[];
    const coursesByOkNo = new Map<string, Course>();

    courses.forEach((course) => {
      const okNo = normalizeOkNo((course as any).ok_no ?? course.data?.ok_no ?? null);
      if (okNo && !coursesByOkNo.has(okNo)) {
        coursesByOkNo.set(okNo, course);
      }
    });

    return specialtyDisciplines.map((discipline) => {
      const normalized = normalizeOkNo(discipline.ok_no ?? discipline.id ?? discipline.no);
      const displayCode = formatDisciplineCode(discipline, normalized);
      const course = normalized ? coursesByOkNo.get(normalized) ?? null : null;
      return {
        discipline,
        normalizedOkNo: normalized,
        displayCode,
        course,
      };
    });
  }, [selectedSpecialty?.data?.disciplines, courses]);

  const resultsByType = useMemo(() => {
    const grouped: Record<ResultType, CourseResult[]> = {
      "ЗК": [],
      "СК": [],
      "РН": []
    };

    results.forEach((result) => {
      if (result.type === "ЗК" || result.type === "СК" || result.type === "РН") {
        grouped[result.type].push(result);
      }
    });

    RESULT_TYPE_ORDER.forEach((type) => {
      grouped[type].sort((a, b) => a.no - b.no);
    });

    return grouped;
  }, [results]);

  const isBusy = isLoadingSpecialty || isLoadingCourses;

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/results")}
              className="text-amber-50 hover:text-amber-200 cursor-pointer px-3 py-2 rounded-lg font-bold flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="hidden sm:inline">До результатів</span>
            </button>
            <h1 className="font-mono text-2xl text-amber-50">Матриця результатів</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSpecialtyId ?? ""}
              onChange={(e) => setSelectedSpecialtyId(e.target.value === "" ? null : Number(e.target.value))}
              className="bg-zinc-900 border-2 border-amber-50 rounded-lg px-3 py-2 text-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="">Виберіть спеціальність</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.code ? `${specialty.code} - ` : ""}{specialty.name} ({specialty.area})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSpecialty && (
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
            <div className="font-bold text-lg">{selectedSpecialty.code ? `${selectedSpecialty.code} - ` : ""}{selectedSpecialty.name}</div>
            <div className="text-sm text-amber-200">{selectedSpecialty.area}</div>
          </div>
        )}

        {!selectedSpecialtyId ? (
          <div className="text-amber-50 font-mono">Виберіть спеціальність для побудови матриці</div>
        ) : isBusy ? (
          <div className="text-amber-50 font-mono">Завантаження даних...</div>
        ) : disciplineRows.length === 0 ? (
          <div className="text-amber-50 font-mono">Для цієї спеціальності немає переліку дисциплін</div>
        ) : (
          <div className="flex flex-col gap-8">
            {disciplineRows.some((row) => !row.course) && (
              <div className="bg-red-950/40 border border-red-500 text-red-200 rounded-xl p-4 flex items-center gap-3 font-mono">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400" />
                <span>Деякі дисципліни відсутні серед курсів – відповідні рядки підсвічені червоним.</span>
              </div>
            )}

            {RESULT_TYPE_ORDER.map((type) => {
              const resultsForType = resultsByType[type];
              return (
                <div key={type} className="flex flex-col gap-3">
                  <h2 className="text-amber-200 font-bold text-xl font-mono border-b-2 border-amber-50 pb-2">
                    {RESULT_TYPES[type]}
                  </h2>
                  {resultsForType.length === 0 ? (
                    <div className="text-amber-50 font-mono text-sm">Немає результатів типу {type}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-2 border-amber-50 rounded-xl overflow-hidden">
                        <thead>
                          <tr className="bg-zinc-900 text-amber-50 font-mono">
                            <th className="px-3 py-2 border border-amber-50 text-left">ОК</th>
                            {resultsForType.map((result) => (
                              <th
                                key={result.id}
                                className="px-3 py-2 border border-amber-50 text-center text-sm"
                                title={result.name}
                              >
                                {formatResultCode(result)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {disciplineRows.map((row) => {
                            const hasCourse = Boolean(row.course);
                            return (
                              <tr
                                key={`${row.displayCode}-${row.discipline.name}`}
                                className={hasCourse ? "bg-zinc-900" : "bg-red-950/30"}
                              >
                                <th className="px-3 py-2 border border-amber-50 text-left align-top text-amber-50 font-mono">
                                  <div className="font-bold">{row.normalizedOkNo ?? row.displayCode}</div>
                                  <div className="text-xs text-amber-200">{row.discipline.name}</div>
                                  {row.course && (
                                    <div className="text-[11px] text-amber-400 mt-1">{row.course.name}</div>
                                  )}
                                  {!row.course && (
                                    <div className="text-[11px] text-red-200 mt-1">Дисципліну не знайдено</div>
                                  )}
                                </th>
                                {resultsForType.map((result) => {
                                  const courseResults = row.course?.data?.results ?? [];
                                  const hasResult = courseResults.includes(result.id);
                                  return (
                                    <td
                                      key={`${row.displayCode}-${result.id}`}
                                      className="px-3 py-2 border border-amber-50 text-center text-amber-50 font-bold"
                                    >
                                      {hasResult ? "+" : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
