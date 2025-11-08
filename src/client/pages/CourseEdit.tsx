import type { Course, Teacher, ShortCourseInfo, CourseResult } from "@/stores/models";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus, faEdit } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { loadCourse, upsertCourse, loadAllCourses } from "../courses";
import { loadAllTeachers } from "../teachers";
import { loadAllResults } from "../results";
import CourseTopicsEditor from "../components/CourseTopicsEditor";
import AttestationsEditor from "../components/AttestationsEditor";
import ResultsEditor from "../components/ResultsEditor";

const RESULT_TYPES = {
  "ЗК": "Загальні компетентності",
  "СК": "Спеціальні компетентності",
  "РН": "Результати навчання"
};

export default function CourseEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState([] as Teacher[]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [prerequisiteInfos, setPrerequisiteInfos] = useState<ShortCourseInfo[]>([]);
  const [postrequisiteInfos, setPostrequisiteInfos] = useState<ShortCourseInfo[]>([]);
  const [allResults, setAllResults] = useState<CourseResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<CourseResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => { loadCourse(id || "new").then(setItem).catch(console.error); }, [id]);
  useEffect(() => { 
    loadAllTeachers().then(setTeachers).catch(console.error); 
    loadAllCourses().then(setAllCourses).catch(console.error);
    loadAllResults().then(setAllResults).catch(console.error);
  }, []);
  
  // Load prerequisite and postrequisite info when item or prerequisites/postrequisites change
  useEffect(() => {
    if (!item || !item.id || item.id < 0) {
      setPrerequisiteInfos([]);
      setPostrequisiteInfos([]);
      setSelectedResults([]);
      return;
    }

    // Since we have allCourses, we can filter them
    const prereqInfos = allCourses
      .filter(c => item.data.prerequisites.includes(c.id))
      .map(c => ({ id: c.id, name: c.name, teacher: c.teacher || "" }));
    setPrerequisiteInfos(prereqInfos);

    const postreqInfos = allCourses
      .filter(c => item.data.postrequisites.includes(c.id))
      .map(c => ({ id: c.id, name: c.name, teacher: c.teacher || "" }));
    setPostrequisiteInfos(postreqInfos);

    // Load selected results
    const selected = allResults.filter(r => item.data.results.includes(r.id));
    setSelectedResults(selected);
  }, [item?.data.prerequisites, item?.data.postrequisites, item?.data.results, allCourses, allResults, item?.id]);

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

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const uploadPromise = (async () => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/courses/from-sylabus", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process syllabus");
      }

      const course = await response.json() as Course;
      setItem(course);
      return course;
    })();

    toast.promise(uploadPromise, {
      loading: "Завантаження та обробка файлу...",
      success: "Файл syllabus успішно оброблено",
      error: "Не вдалося обробити файл syllabus",
    });

    try {
      await uploadPromise;
    } catch (error) {
      console.error("Error uploading syllabus:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled: isUploading,
    onDropRejected: () => {
      toast.error("Будь ласка, перетягніть файл .docx");
    }
  });

  const handleAddPrerequisite = (courseId: string) => {
    if (!item || !courseId) return;
    const id = Number(courseId);
    if (item.data.prerequisites.includes(id)) return;
    
    const newPrerequisites = [...item.data.prerequisites, id];
    updateData({ prerequisites: newPrerequisites });
  };

  const handleRemovePrerequisite = (courseId: number) => {
    if (!item) return;
    const newPrerequisites = item.data.prerequisites.filter(id => id !== courseId);
    updateData({ prerequisites: newPrerequisites });
  };

  const handleAddPostrequisite = (courseId: string) => {
    if (!item || !courseId) return;
    const id = Number(courseId);
    if (item.data.postrequisites.includes(id)) return;
    
    const newPostrequisites = [...item.data.postrequisites, id];
    updateData({ postrequisites: newPostrequisites });
  };

  const handleRemovePostrequisite = (courseId: number) => {
    if (!item) return;
    const newPostrequisites = item.data.postrequisites.filter(id => id !== courseId);
    updateData({ postrequisites: newPostrequisites });
  };

  // Get available courses for selection (exclude current course and already selected ones)
  const getAvailableCoursesForPrerequisites = () => {
    if (!item) return [];
    return allCourses.filter(c => 
      c.id !== item.id && 
      c.id >= 0 && 
      !item.data.prerequisites.includes(c.id)
    );
  };

  const getAvailableCoursesForPostrequisites = () => {
    if (!item) return [];
    return allCourses.filter(c => 
      c.id !== item.id && 
      c.id >= 0 && 
      !item.data.postrequisites.includes(c.id)
    );
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

  const isValid = useMemo(() => {
    if (!item) return false;
    return item.name.trim() !== "" && item.data.credits > 0 && item.data.hours > 0 && item.data.specialty.trim() !== "";
  }, [item]);

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Курс не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-mono">Редагувати курс</h1>          
        </div>
        
        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono">
          <label className="block text-[#fbf0df] font-bold mb-2">Завантажити з Силабуса (.docx):</label>
          <div
            {...getRootProps()}
            className={`border-2 ${isDragActive ? "border-[#f3d5a3] border-dashed bg-[#2a2a2a]" : "border-transparent"} rounded-lg p-4 text-center transition-colors duration-200 ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
          >
            <input {...getInputProps()} />
            {isUploading ? (<span className="text-[#fbf0df]">Завантаження...</span>) : (
              <span className="text-[#fbf0df]">
                {isDragActive ? "Відпустіть файл тут" : "Перетягніть файл .docx або натисніть для вибору"}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">          
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Назва:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.name} onChange={(e) => update({name: e.target.value})} />
            </div>
            <div className="flex items-start justify-end gap-2">
              { item?.generated && item.id && (
                <button
                  onClick={() => navigate(`/courses/${item.id}/generated`)}
                  className="col-span-2"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              )}
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Кредити:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.credits || "")} onChange={(e) => updateData({credits: Number(e.target.value) || 0})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Години:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={String(item.data.hours || "")} onChange={(e) => updateData({hours: Number(e.target.value) || 0})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Спеціальність:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.specialty} onChange={(e) => updateData({specialty: e.target.value})} />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Напрям:</label>
              <input className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.area} onChange={(e) => updateData({area: e.target.value})} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="optional-checkbox"
                className="w-5 h-5 cursor-pointer accent-[#fbf0df]"
                checked={item.data.optional}
                onChange={(e) => updateData({optional: e.target.checked})}
              />
              <label htmlFor="optional-checkbox" className="text-[#fbf0df] font-bold cursor-pointer">
                Вибіркова дисципліна
              </label>
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Форма контролю:</label>
              <select
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.control_type || "credit"}
                onChange={(e) => updateData({control_type: e.target.value as "exam" | "credit" | "both"})}
              >
                <option value="credit">Залік</option>
                <option value="exam">Іспит</option>
                <option value="both">Залік та іспит</option>
              </select>
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Рік навчання (денна):</label>
              <input 
                type="number"
                min="1"
                max="6"
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.fulltime?.study_year || 1} 
                onChange={(e) => {
                  const fulltime = { ...item.data.fulltime, study_year: Number(e.target.value) || 1 };
                  updateData({ fulltime });
                }} 
              />
            </div>
            <div>
              <label className="block text-[#fbf0df] font-bold mb-2">Рік навчання (заочна):</label>
              <input 
                type="number"
                min="1"
                max="6"
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.data.inabscentia?.study_year || 1} 
                onChange={(e) => {
                  const inabscentia = { ...item.data.inabscentia, study_year: Number(e.target.value) || 1 };
                  updateData({ inabscentia });
                }} 
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Викладач:</label>
              <select
                className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
                value={item.teacher_id}
                onChange={e => update({teacher_id: e.target.value})}
              >
                <option value="">-- Виберіть викладача --</option>
                { teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>) }
              </select>              
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Передумови:</label>
              <div className="flex flex-col gap-2">
                {item.data.prerequisites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {prerequisiteInfos.map((prereq) => (
                      <div
                        key={prereq.id}
                        className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <span className="text-[#fbf0df] font-mono text-sm">{prereq.name}</span>
                        <button
                          onClick={() => handleRemovePrerequisite(prereq.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                          aria-label="Видалити передумову"
                        >
                          <FontAwesomeIcon icon={faTimes} size="xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPrerequisite(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">-- Додати передумову --</option>
                  {getAvailableCoursesForPrerequisites().map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Залежні дисципліни:</label>
              <div className="flex flex-col gap-2">
                {item.data.postrequisites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {postrequisiteInfos.map((postreq) => (
                      <div
                        key={postreq.id}
                        className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <span className="text-[#fbf0df] font-mono text-sm">{postreq.name}</span>
                        <button
                          onClick={() => handleRemovePostrequisite(postreq.id)}
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                          aria-label="Видалити наступний курс"
                        >
                          <FontAwesomeIcon icon={faTimes} size="xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPostrequisite(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">-- Додати наступний курс --</option>
                  {getAvailableCoursesForPostrequisites().map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Додатковий опис:</label>
              <textarea rows={5} className="w-full bg-transparent border-0 text-[#fbf0df] font-mono text-base py-1.5 px-2 outline-none focus:text-white"
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
              />
            ))}
            <div className="col-span-2">
              <label className="block text-[#fbf0df] font-bold mb-2">Семестри:</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#fbf0df] font-bold mb-2 text-sm">Денна форма:</label>
                  <div className="flex flex-col gap-2">
                    {(item.data.fulltime?.semesters || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(item.data.fulltime?.semesters || []).map((semester) => (
                          <div
                            key={semester}
                            className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                          >
                            <span className="text-[#fbf0df] font-mono text-sm">{semester} семестр</span>
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
                      className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
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
                  <label className="block text-[#fbf0df] font-bold mb-2 text-sm">Заочна форма:</label>
                  <div className="flex flex-col gap-2">
                    {(item.data.inabscentia?.semesters || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(item.data.inabscentia?.semesters || []).map((semester) => (
                          <div
                            key={semester}
                            className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
                          >
                            <span className="text-[#fbf0df] font-mono text-sm">{semester} семестр</span>
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
                      className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
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

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!isValid}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold">
              Зберегти
            </button>
            <button onClick={() => navigate("/courses")}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold">
              Скасувати
            </button>
          </div>
        </div>

        {item?.id && <CourseTopicsEditor courseId={item.id} />}

      </div>
    </div>
  );
}
