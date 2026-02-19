import type { Course, Teacher, ShortCourseInfo, CourseResult, Specialty } from "@/stores/models";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus, faEdit, faCheck } from "@fortawesome/free-solid-svg-icons";
import { loadCourse, upsertCourse, loadAllCourses, normalizeCourseName, formatDisciplineCode, autofillCourseResults } from "../courses";

function extractRawCourseName(displayName: string): string {
  return displayName.replace(/^(ОК\d+(?:\.\d+)?|ВК\d+(?:\.\d+)?)\s+/i, "").trim();
}
import { loadAllTeachers } from "../teachers";
import { loadAllResults } from "../results";
import { loadAllSpecialties } from "../specialties";
import CourseTopicsEditor from "../components/CourseTopicsEditor";
import AttestationsEditor from "../components/AttestationsEditor";
import ResultsEditor from "../components/ResultsEditor";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності",
  "РН": "Результати навчання"
};

type ResultType = "ЗК" | "СК" | "ПР";

type DependencyField = "prerequisites" | "postrequisites";

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState([] as Teacher[]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [allResults, setAllResults] = useState<CourseResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<CourseResult[]>([]);
  const [autofillLoading, setAutofillLoading] = useState<Record<ResultType, boolean>>({
    "ЗК": false,
    "СК": false,
    "ПР": false
  });
  type CourseWithOk = ShortCourseInfo & { okNo: string | null; displayName: string };

  const [allCoursesList, setAllCoursesList] = useState<CourseWithOk[]>([]);
  const [dependencyInputs, setDependencyInputs] = useState<Record<DependencyField, string>>({
    prerequisites: "",
    postrequisites: ""
  });

  useEffect(() => { loadCourse(id || "new").then(setItem).catch(console.error); }, [id]);
  useEffect(() => { 
    loadAllTeachers().then(setTeachers).catch(console.error); 
    loadAllResults().then(setAllResults).catch(console.error);
    loadAllSpecialties().then(setSpecialties).catch(console.error);
  }, []);

  useEffect(() => {
    loadAllCourses()
      .then(courses => {
        setAllCoursesList(courses.map(course => ({
          id: course.id,
          name: course.name,
          teacher: course.teacher || "",
          okNo: course.data.ok_no ?? null,
          displayName: formatDisciplineCode(course.data.ok_no) + " " + course.name
        })));
      })
      .catch(console.error);
  }, []);
  
  // Load prerequisite and postrequisite info when item or prerequisites/postrequisites change
  useEffect(() => {
    if (!item || !item.id || item.id < 0) {
      setSelectedResults([]);
      return;
    }

    // Load selected results
    const selected = allResults.filter(r => item.data.results.includes(r.id));
    setSelectedResults(selected);
  }, [item?.data.results, allResults, item?.id]);

  const update = (json: any) => {
    if (!item) return;
    setItem({ ...item, ...json } as Course);
  }

  const updateData = (json: any) => {
    if (!item) return;
    const data = { ...item.data, ...json };
    setItem({ ...item, data } as Course);
  }

  const handleSave = async () => {
    if (!item || !isValid) return;
    await upsertCourse(item);
    navigate("/courses");
  };

  const handleAddResult = (resultId: string) => {
    if (!item || !resultId) return;
    const id = Number(resultId);
    if (item.data.results.includes(id)) return;
    
    const newResults = [...item.data.results, id];
    updateData({ results: newResults });
  };

  const handleRemoveResult = (resultId: number) => {
    if (!item) return;
    const newResults = item.data.results.filter(id => id !== resultId);
    updateData({ results: newResults });
  };

  const handleAutofillResults = async (type: ResultType) => {
    if (!item || item.id < 0) return;
    
    setAutofillLoading(prev => ({ ...prev, [type]: true }));
    
    try {
      const matchedResults = await autofillCourseResults(item.id, type);
      
      const newResultIds = matchedResults
        .map(r => r.id)
        .filter(id => !item.data.results.includes(id));
      
      if (newResultIds.length > 0) {
        updateData({ results: [...item.data.results, ...newResultIds] });
      }
    } catch (error) {
      console.error("Error autofilling results:", error);
    } finally {
      setAutofillLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Get available results for each type, excluding already selected ones
  const getAvailableResultsForType = (type: 'ЗК' | 'СК' | 'РН') => {
    if (!item) return [];
    return allResults.filter(r => 
      r.type === type && 
      !item.data.results.includes(r.id)
    );
  };

  // Get selected results for each type
  const getSelectedResultsForType = (type: 'ЗК' | 'СК' | 'РН') => {
    return selectedResults.filter(r => r.type === type);
  };

  const dependencyCourseOptions = useMemo(() => {
    const excludeName = item ? normalizeCourseName(item.name) : null;
    const seen = new Set<string>();
    const deduped: CourseWithOk[] = [];

    allCoursesList.forEach(course => {
      const name = course.name?.trim();
      if (!name) return;
      const normalized = normalizeCourseName(name);
      if (excludeName && normalized === excludeName) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);
      deduped.push(course);
    });

    return deduped.sort((a, b) => {
      const codeA = a.okNo;
      const codeB = b.okNo;
      if (codeA === codeB) return a.name.localeCompare(b.name, "uk");
      if (codeA === null) return 1;
      if (codeB === null) return -1;
      const isOkA = /^\d{1,2}$/.test(codeA);
      const isOkB = /^\d{1,2}$/.test(codeB);
      if (isOkA && isOkB) return Number(codeA) - Number(codeB);
      if (isOkA && !isOkB) return -1;
      if (!isOkA && isOkB) return 1;
      return codeA.localeCompare(codeB);
    });
  }, [allCoursesList, item?.name]);

  const handleAddDependency = (field: DependencyField) => {
    if (!item) return;
    const value = dependencyInputs[field].trim();
    if (!value) return;

    const normalizedNew = normalizeCourseName(extractRawCourseName(value));
    const current = item.data[field] || [];
    const alreadyExists = current.some(existing => normalizeCourseName(existing) === normalizedNew);

    if (alreadyExists) {
      setDependencyInputs(prev => ({ ...prev, [field]: "" }));
      return;
    }

    updateData({ [field]: [...current, extractRawCourseName(value)] });
    setDependencyInputs(prev => ({ ...prev, [field]: "" }));
  };

  const handleRemoveDependency = (field: DependencyField, index: number) => {
    if (!item) return;
    const current = item.data[field] || [];
    const next = current.filter((_, i) => i !== index);
    updateData({ [field]: next });
  };

  const renderDependencyEditor = (field: DependencyField, label: string) => {
    if (!item) return null;
    const dependencies = item.data[field] || [];
    const datalistId = `${field}-courses`;
    const inputValue = dependencyInputs[field];
    const isAddDisabled = inputValue.trim() === "";

    return (
      <div className="col-span-2">
        <label className="block text-amber-50 font-bold mb-2">{label}:</label>
        <div className="flex flex-col gap-2">
          {dependencies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {dependencies.map((name, index) => (
                <div
                  key={`${field}-${name}-${index}`}
                  className="bg-zinc-800 border border-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-2"
                >
                  <span className="text-amber-50 font-mono text-sm">{name}</span>
                  <button
                    onClick={() => handleRemoveDependency(field, index)}
                    className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                    aria-label={`Видалити ${label}`}
                  >
                    <FontAwesomeIcon icon={faTimes} size="xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="flex-1 w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
              list={datalistId}
              value={inputValue}
              onChange={(e) => setDependencyInputs(prev => ({ ...prev, [field]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDependency(field);
                }
              }}
              placeholder="Почніть вводити назву дисципліни"
            />
            <button
              type="button"
              onClick={() => handleAddDependency(field)}
              disabled={isAddDisabled}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold px-4 py-1.5 rounded transition-colors"
            >
              Додати
            </button>
          </div>
          <datalist id={datalistId}>
            {dependencyCourseOptions.map(course => (
              <option
                key={`${field}-${course.id}`}
                value={course.displayName}
              >
                {course.displayName}
              </option>
            ))}
          </datalist>
          <span className="text-xs text-zinc-500">
            Можна додати будь-яку назву; підказки показують наявні дисципліни.
          </span>
        </div>
      </div>
    );
  };

  const handleAddAttestation = (attestation: string, semester: number = 1) => {
    if (!item || !attestation.trim()) return;
    const trimmed = attestation.trim();
    // Check if attestation with same name already exists
    if (item.data.attestations.some(a => a.name === trimmed)) return;
    
    const newAttestations = [...item.data.attestations, { name: trimmed, semester }];
    updateData({ attestations: newAttestations });
  };

  const handleUpdateAttestationSemester = (index: number, semester: number) => {
    if (!item) return;
    const newAttestations = item.data.attestations.map((att, i) => 
      i === index ? { ...att, semester } : att
    );
    updateData({ attestations: newAttestations });
  };

  const handleRemoveAttestation = (index: number) => {
    if (!item) return;
    const newAttestations = item.data.attestations.filter((_, i) => i !== index);
    updateData({ attestations: newAttestations });
  };

  const handleAddSemester = (form: 'fulltime' | 'inabscentia', semester: number) => {
    if (!item) return;
    const currentForm = item.data[form] || { semesters: [], study_year: 1 };
    const currentSemesters = currentForm.semesters || [];
    if (currentSemesters.includes(semester)) return;
    const newSemesters = {
      ...currentForm,
      semesters: [...currentSemesters, semester].sort((a, b) => a - b)
    };
    updateData({ 
      [form]: newSemesters
    });
  };

  const handleRemoveSemester = (form: 'fulltime' | 'inabscentia', semester: number) => {
    if (!item) return;
    const currentForm = item.data[form] || { semesters: [], study_year: 1 };
    const currentSemesters = currentForm.semesters || [];
    const newSemesters = {
      ...currentForm,
      semesters: currentSemesters.filter(s => s !== semester)
    };
    updateData({ 
      [form]: newSemesters
    });
  };

  const stripNumbering = (text: string): string => {
    // Remove common numbering patterns at the start of lines:
    // "1. ", "2. ", "1) ", "2) ", "1 - ", "2 - ", etc.
    return text.replace(/^\d+[\.\)\-\s]+\s*/gm, '').trim();
  };

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && item.data.credits > 0 && item.data.hours > 0 && item.specialty_id > 0;
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-amber-50 font-mono">Курс не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">Редагувати курс</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="text-amber-50 hover:text-green-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded disabled:opacity-30"
              aria-label="Зберегти"
              title="Зберегти"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={() => navigate("/courses")}
              className="text-amber-50 hover:text-red-400"
              aria-label="Скасувати"
              title="Скасувати"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">          
            <div>
              <label className="block text-amber-50 font-bold mb-2">Назва:</label>
              <input className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name} onChange={(e) => update({name: e.target.value})} />
            </div>
            <div className="flex items-start justify-end gap-2">
              {item?.id && (
                <Link
                  to={`/courses/${item.id}/generated`}
                  className="inline-flex items-center gap-2 text-amber-50 hover:text-blue-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                  aria-label="Редагувати згенеровані дані курсу"
                  title="Редагувати згенеровані дані курсу"
                >
                  <FontAwesomeIcon icon={faEdit} />
                  <span className="text-sm">Згенеровані дані</span>
                </Link>
              )}
            </div>
            <div>
              <label className="block text-amber-50 font-bold mb-2">Кредити:</label>
              <input className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.credits || "")} onChange={(e) => updateData({credits: Number(e.target.value) || 0})} />
            </div>
             <div>
               <label className="block text-amber-50 font-bold mb-2">Години:</label>
               <input className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                 value={String(item.data.hours || "")} onChange={(e) => updateData({hours: Number(e.target.value) || 0})} />
             </div>
             <div>
               <label className="block text-amber-50 font-bold mb-2">Номер ОК:</label>
               <input
                 className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                 value={item.data.ok_no ?? ""}
                 onChange={(e) => {
                   const raw = e.target.value.replace(/,/g, ".");
                   const trimmed = raw.trim();
                   updateData({ ok_no: trimmed === "" ? null : trimmed });
                 }}
                 placeholder="Наприклад 1 або 1.3"
               />
             </div>
             <div>
                <label className="block text-amber-50 font-bold mb-2">Спеціальність:</label>
                <select
                  className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                  value={item.specialty_id}
                  onChange={(e) => update({ specialty_id: Number(e.target.value) })}
                >
                  <option value="">-- Виберіть спеціальність --</option>
                  { specialties.map(s => <option key={s.id} value={s.id}>{s.code} {s.name}</option>) }
                </select>
              </div>
              <div>
                <label className="block text-amber-50 font-bold mb-2">Напрям:</label>
                <input className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                  value={item.data.area} onChange={(e) => updateData({area: e.target.value})} />
              </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optional-checkbox"
                className="w-5 h-5 cursor-pointer accent-amber-50"
                checked={item.data.optional}
                onChange={(e) => updateData({optional: e.target.checked})}
              />
              <label htmlFor="optional-checkbox" className="text-amber-50 font-bold cursor-pointer">
                Вибіркова дисципліна
              </label>
            </div>
            <div>
              <label className="block text-amber-50 font-bold mb-2">Форма контролю:</label>
              <select
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.control_type || "credit"}
                onChange={(e) => updateData({control_type: e.target.value as "exam" | "credit" | "both"})}
              >
                <option value="credit">Залік</option>
                <option value="exam">Іспит</option>
                <option value="both">Залік та іспит</option>
              </select>
            </div>
            <div>
              <label className="block text-amber-50 font-bold mb-2">Рік навчання (денна):</label>
              <input 
                type="number"
                min="1"
                max="6"
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.fulltime?.study_year || 1} 
                onChange={(e) => {
                  const fulltime = { ...item.data.fulltime, study_year: Number(e.target.value) || 1 };
                  updateData({ fulltime });
                }} 
              />
            </div>
            <div>
              <label className="block text-amber-50 font-bold mb-2">Рік навчання (заочна):</label>
              <input 
                type="number"
                min="1"
                max="6"
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.inabscentia?.study_year || 1} 
                onChange={(e) => {
                  const inabscentia = { ...item.data.inabscentia, study_year: Number(e.target.value) || 1 };
                  updateData({ inabscentia });
                }} 
              />
            </div>
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Викладач:</label>
              <select
                className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.teacher_id}
                onChange={e => update({teacher_id: e.target.value})}
              >
                <option value="">-- Виберіть викладача --</option>
                { teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>) }
              </select>              
            </div>            
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Додатковий опис:</label>
              <textarea rows={5} className="w-full bg-transparent border-0 text-amber-50 font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.description} onChange={(e) => updateData({description: e.target.value})} />
            </div>            
            {(["ЗК", "СК", "РН"] as const).map(type => (
              <ResultsEditor
                key={type}
                label={RESULT_TYPES[type]}
                selectedResults={getSelectedResultsForType(type)}
                availableResults={getAvailableResultsForType(type)}
                onAdd={handleAddResult}
                onRemove={handleRemoveResult}
                onAutofill={item?.id && item.id > 0 ? () => handleAutofillResults(type === "РН" ? "ПР" : type) : undefined}
                autofillLoading={autofillLoading[type === "РН" ? "ПР" : type]}
              />
            ))}
            {renderDependencyEditor("prerequisites", "Пререквізити")}
            {renderDependencyEditor("postrequisites", "Постреквізити")}
            <div className="col-span-2">
              <label className="block text-amber-50 font-bold mb-2">Семестри:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-amber-50 font-bold mb-2 text-sm">Денна форма:</label>
                  <div className="flex flex-col gap-2">
                    {(item.data.fulltime?.semesters || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(item.data.fulltime?.semesters || []).map((semester) => (
                          <div
                            key={semester}
                            className="bg-zinc-800 border border-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-2"
                          >
                            <span className="text-amber-50 font-mono text-sm">{semester} семестр</span>
                            <button
                              onClick={() => handleRemoveSemester('fulltime', semester)}
                              className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                              aria-label="Видалити семестр"
                            >
                              <FontAwesomeIcon icon={faTimes} size="xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <select
                      className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddSemester('fulltime', Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">-- Додати семестр --</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>
                          {sem} семестр
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-amber-50 font-bold mb-2 text-sm">Заочна форма:</label>
                  <div className="flex flex-col gap-2">
                    {(item.data.inabscentia?.semesters || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(item.data.inabscentia?.semesters || []).map((semester) => (
                          <div
                            key={semester}
                            className="bg-zinc-800 border border-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-2"
                          >
                            <span className="text-amber-50 font-mono text-sm">{semester} семестр</span>
                            <button
                              onClick={() => handleRemoveSemester('inabscentia', semester)}
                              className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                              aria-label="Видалити семестр"
                            >
                              <FontAwesomeIcon icon={faTimes} size="xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <select
                      className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddSemester('inabscentia', Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">-- Додати семестр --</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>
                          {sem} семестр
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <AttestationsEditor
              attestations={item.data.attestations}
              onAdd={handleAddAttestation}
              onUpdateSemester={handleUpdateAttestationSemester}
              onRemove={handleRemoveAttestation}
            />
          </div>
        </div>

        {item?.id && <CourseTopicsEditor courseId={item.id} />}

        <div className="col-span-2">
          <label className="block text-amber-50 font-bold mb-2 text-sm">Основна література (одна на рядок):</label>
          <textarea
            rows={8}
            className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y placeholder:text-zinc-600"
            value={(item.data.literature?.main || []).join("\n")}
            onChange={(e) => {
              const main = e.target.value
                .split("\n")
                .map(line => stripNumbering(line))
                .filter(line => line.trim() !== "");
              const literature = {
                main,
                additional: item.data.literature?.additional || [],
                internet: item.data.literature?.internet || []
              };
              updateData({ literature });
            }}
            placeholder="Література"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-amber-50 font-bold mb-2 text-sm">Додаткова (одна на рядок):</label>
          <textarea
            rows={8}
            className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y placeholder:text-zinc-600"
            value={(item.data.literature?.additional || []).join("\n")}
            onChange={(e) => {
              const additional = e.target.value
                .split("\n")
                .map(line => stripNumbering(line))
                .filter(line => line.trim() !== "");
              const literature = {
                main: item.data.literature?.main || [],
                additional,
                internet: item.data.literature?.internet || []
              };
              updateData({ literature });
            }}
            placeholder="Література"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-amber-50 font-bold mb-2 text-sm">Інтернет-ресурси (одна на рядок):</label>
          <textarea
            rows={8}
            className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y placeholder:text-zinc-600"
            value={(item.data.literature?.internet || []).join("\n")}
            onChange={(e) => {
              const internet = e.target.value
                .split("\n")
                .map(line => stripNumbering(line))
                .filter(line => line.trim() !== "");
              const literature = {
                main: item.data.literature?.main || [],
                additional: item.data.literature?.additional || [],
                internet
              };
              updateData({ literature });
            }}
            placeholder="http://interesting-site.com"
          />
        </div>
      </div>
    </div>
  );
}
