import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faSearch } from "@fortawesome/free-solid-svg-icons";
import type { Course, CourseResult } from "@/stores/models";
import { formatDisciplineCode, loadAllCourses } from "../courses";
import { loadAllResults } from "../results";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності", 
  "РН": "Результати навчання"
};

export default function CoursesWithResults() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [results, setResults] = useState<CourseResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Load courses and results in parallel
        const [coursesData, resultsData] = await Promise.all([
          loadAllCourses(),
          loadAllResults()
        ]);
        
        setCourses(coursesData);
        setResults(resultsData);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Не вдалося завантажити дані");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);



   // Create a map of result IDs to result objects for quick lookup
   const resultIdMap = useMemo(() => {
     const map = new Map<number, CourseResult>();
     results.forEach(result => {
       map.set(result.id, result);
     });
     return map;
   }, [results]);

   // Filter courses based on search text
   const filteredCourses = useMemo(() => {
     if (!filterText.trim()) return courses;
     
     const searchText = filterText.toLowerCase();
     return courses.filter(course => {
       const okNoText = course.data.ok_no ? course.data.ok_no.toString().toLowerCase() : "";
       const nameText = course.name.toLowerCase();
       const teacherText = (course.teacher ?? course.teacher_id.toString()).toLowerCase();
       
       return okNoText.includes(searchText) || 
              nameText.includes(searchText) || 
              teacherText.includes(searchText);
     });
   }, [courses, filterText]);

  // Format result code for display
  function formatResultCode(result: CourseResult): string {
    return `${result.type ?? ""}${result.no}`;
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-amber-50 font-mono">Завантаження даних...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-red-500 font-mono">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-zinc-900 border-2 border-amber-50 rounded-xl px-4 py-2 text-amber-50 font-mono hover:bg-zinc-800 transition-colors"
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <h1 className="font-mono text-2xl">Дисципліни з результатами</h1>
          </div>

          <div className="relative flex-1 max-w-md">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-200" />
            <input
              type="text"
              placeholder=""
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-zinc-900 border-2 border-amber-50 rounded-lg px-10 py-2 text-amber-50 font-mono focus:outline-none focus:ring-2 focus:ring-amber-200 placeholder-amber-200"
            />
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="text-amber-50 font-mono">
            {filterText ? "Не знайдено дисциплін, що відповідають фільтру" : "Немає дисциплін"}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {filteredCourses.map(course => {
              const courseResults = course.data.results ?? [];
              const hasResults = courseResults.length > 0;

              return (
                <div key={course.id} className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="font-bold text-lg">
                        {formatDisciplineCode(course.data.ok_no) + '. '}{course.name}
                      </div>
                      <div className="text-sm opacity-80">
                        Викладач: {course.teacher ?? course.teacher_id}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/courses/${course.id}`)}
                      className="text-amber-50 hover:text-amber-200 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати дисципліну"
                      title="Редагувати дисципліну"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </div>

                  {hasResults ? (
                    <div className="flex flex-col gap-4">
                      {Object.entries(RESULT_TYPES).map(([type, typeName]) => {
                        const typeResults = courseResults
                          .map(resultId => resultIdMap.get(resultId))
                          .filter((result): result is CourseResult => 
                            result !== undefined && result.type === type
                          );

                        if (typeResults.length === 0) return null;

                        return (
                          <div key={type} className="flex flex-col gap-2">
                            <h3 className="text-amber-200 font-bold text-base">{typeName}</h3>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                              {typeResults.map(result => (
                                <li key={result.id} className="text-sm">
                                  <span className="font-bold text-amber-200">{formatResultCode(result)}</span> - {result.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-amber-200 text-sm">
                      Ця дисципліна не має пов'язаних результатів
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