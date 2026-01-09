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

type MatrixRow = {
  discipline: SpecialtyDisciplineConfig;
  normalizedOkNo: string | null;
  displayCode: string;
  course: Course | null;
};

function formatDisciplineCode(discipline: SpecialtyDisciplineConfig): string {
  return `ОК${discipline.ok_no ?? '??'}`;
}

function formatResultCode(result: CourseResult): string {
  return `${result.type ?? ""}${result.no}`;
}

export default function ResultsMatrix() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<number | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingSpecialty, setIsLoadingSpecialty] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);

  useEffect(() => {
    loadAllSpecialties()
      .then(list => {
        setSpecialties(list);
        const id = list.length > 0 ? list[0]?.id : null;
        if(id) setSelectedSpecialtyId(id);
      })
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
    const specialtyDisciplines = (selectedSpecialty?.data?.disciplines ?? []) as SpecialtyDisciplineConfig[];
    const coursesByOkNo = new Map<string, Course>();

    courses.forEach((course) => {
      const okNo = course.data?.ok_no;
      if (okNo) {
        if(coursesByOkNo.has(okNo)) {
          // TODO: show errors list in UI
          console.warn(`Duplicate course for OK number ${okNo}: "${coursesByOkNo.get(okNo)?.name}" and "${course.name}"`);
        }
        coursesByOkNo.set(okNo, course);
      }
    });

    return specialtyDisciplines.map((discipline) => {
      const okNo = discipline.ok_no ?? '';
      const displayCode = formatDisciplineCode(discipline);
      const course = okNo ? coursesByOkNo.get(okNo) ?? null : null;

      return {
        discipline,
        normalizedOkNo: okNo,
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

  const uncoveredResultsByType = useMemo(() => {
    const uncovered: Record<ResultType, CourseResult[]> = {
      "ЗК": [],
      "СК": [],
      "РН": []
    };

    // Collect all result IDs covered by courses
    const coveredResultIds = new Set<number>();
    courses.forEach((course) => {
      (course.data?.results ?? []).forEach((resultId) => {
        coveredResultIds.add(resultId);
      });
    });

    // Find results that are not covered by any course
    results.forEach((result) => {
      if (result.type === "ЗК" || result.type === "СК" || result.type === "РН") {
        if (!coveredResultIds.has(result.id)) {
          uncovered[result.type].push(result);
        }
      }
    });

    return uncovered;
  }, [results, courses]);

  const hasUncoveredResults = useMemo(() => {
    return RESULT_TYPE_ORDER.some((type) => uncoveredResultsByType[type].length > 0);
  }, [uncoveredResultsByType]);

  const isBusy = isLoadingSpecialty || isLoadingCourses;

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
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
         
         {selectedSpecialtyId && !isBusy && (
           <div className={'mt-8 border-2 rounded-xl p-4' + (hasUncoveredResults ? ' bg-red-950/20 border-red-500' : ' bg-green-950/20 border-green-500')}>
             <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
               <FontAwesomeIcon icon={faExclamationTriangle} />
               {hasUncoveredResults ? "Результати, які не покриті жодною дисципліною" : "Всі результати покриті"}
             </h3>

             {RESULT_TYPE_ORDER.map((type) => {
               const uncoveredResults = uncoveredResultsByType[type];
               return (
                 <div key={type} className="mb-4">
                   <h4 className="font-bold text-amber-200 mb-2">{RESULT_TYPES[type]}</h4>
                   {uncoveredResults.length === 0 ? (
                     <div className="text-green-200 text-sm">Всі результати типу {type} покриті</div>
                   ) : (
                     <ul className="list-disc list-inside space-y-1">
                       {uncoveredResults.map((result) => (
                         <li key={result.id} className="text-sm">
                           {formatResultCode(result)} - {result.name}
                         </li>
                       ))}
                     </ul>
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
