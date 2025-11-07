import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { Course, GeneratedCourseData } from "@/stores/models";
import toast from "react-hot-toast";

export default function CourseGeneratedDataEdit() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [disciplineQuestions, setDisciplineQuestions] = useState<string[]>([]);
  const [newDisciplineQuestion, setNewDisciplineQuestion] = useState("");
  const [selfMethodGoal, setSelfMethodGoal] = useState("");
  const [selfMethodTask, setSelfMethodTask] = useState("");
  const [selfMethodGeneral, setSelfMethodGeneral] = useState("");
  const [selfMethodIndividualTopics, setSelfMethodIndividualTopics] = useState<string[]>([]);
  const [newSelfMethodIndividualTopic, setNewSelfMethodIndividualTopic] = useState("");
  const [programGoal, setProgramGoal] = useState("");
  const [programTask, setProgramTask] = useState("");
  const [programSubject, setProgramSubject] = useState("");
  const [programOrientation, setProgramOrientation] = useState("");
  const [programBriefResults, setProgramBriefResults] = useState("");
  const [programBriefSkills, setProgramBriefSkills] = useState("");
  const [programIntro, setProgramIntro] = useState("");
  const [programBriefIntro, setProgramBriefIntro] = useState("");

  useEffect(() => {
    if (courseId) {
      fetchCourse();
    }
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (!response.ok) {
        throw new Error("Failed to load course");
      }
      const data = await response.json() as Course;
      setCourse(data);

      // Initialize form state from generated data
      const generated = data.generated || {} as GeneratedCourseData;

      setDisciplineQuestions(generated.disciplineQuestions || []);
      setSelfMethodGoal(generated.selfMethodGoal || "");
      setSelfMethodTask(generated.selfMethodTask || "");
      setSelfMethodGeneral(generated.selfMethodGeneral || "");
      setSelfMethodIndividualTopics(generated.selfMethodIndividualTopics || []);
      setProgramGoal(generated.programGoal || "");
      setProgramTask(generated.programTask || "");
      setProgramSubject(generated.programSubject || "");
      setProgramOrientation(generated.programOrientation || "");
      setProgramBriefResults(generated.programBriefResults || "");
      setProgramBriefSkills(generated.programBriefSkills || "");
      setProgramIntro(generated.programIntro || "");
      setProgramBriefIntro(generated.programBriefIntro || "");
    } catch (error) {
      console.error("Error fetching course:", error);
      toast.error("Помилка завантаження курсу");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!course) return;

    setIsSaving(true);
    try {
      const updatedGenerated: GeneratedCourseData = {
        ...course.generated,
        disciplineQuestions,
        selfMethodGoal,
        selfMethodTask,
        selfMethodGeneral,
        selfMethodIndividualTopics,
        programGoal,
        programTask,
        programSubject,
        programOrientation,
        programBriefResults,
        programBriefSkills,
        programIntro,
        programBriefIntro
      };

      const updatedCourse: Course = {
        ...course,
        generated: updatedGenerated
      };

      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedCourse)
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Дані успішно збережено");
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Error saving course:", error);
      toast.error("Помилка збереження даних");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDisciplineQuestion = () => {
    if (newDisciplineQuestion.trim()) {
      setDisciplineQuestions([...disciplineQuestions, newDisciplineQuestion.trim()]);
      setNewDisciplineQuestion("");
    }
  };

  const handleRemoveDisciplineQuestion = (index: number) => {
    setDisciplineQuestions(disciplineQuestions.filter((_, i) => i !== index));
  };

  const handleResetDisciplineQuestions = () => {
    setDisciplineQuestions([]);
  };

  const handleAddSelfMethodIndividualTopic = () => {
    if (newSelfMethodIndividualTopic.trim()) {
      setSelfMethodIndividualTopics([...selfMethodIndividualTopics, newSelfMethodIndividualTopic.trim()]);
      setNewSelfMethodIndividualTopic("");
    }
  };

  const handleRemoveSelfMethodIndividualTopic = (index: number) => {
    setSelfMethodIndividualTopics(selfMethodIndividualTopics.filter((_, i) => i !== index));
  };

  const handleResetSelfMethodGoal = () => {
    setSelfMethodGoal("");
  };

  const handleResetSelfMethodTask = () => {
    setSelfMethodTask("");
  };

  const handleResetSelfMethodGeneral = () => {
    setSelfMethodGeneral("");
  };

  const handleResetSelfMethodIndividualTopics = () => {
    setSelfMethodIndividualTopics([]);
  };

  const handleResetProgramGoal = () => {
    setProgramGoal("");
  };

  const handleResetProgramTask = () => {
    setProgramTask("");
  };

  const handleResetProgramSubject = () => {
    setProgramSubject("");
  };

  const handleResetProgramOrientation = () => {
    setProgramOrientation("");
  };

  const handleResetProgramBriefResults = () => {
    setProgramBriefResults("");
  };

  const handleResetProgramBriefSkills = () => {
    setProgramBriefSkills("");
  };

  const handleResetProgramIntro = () => {
    setProgramIntro("");
  };

  const handleResetProgramBriefIntro = () => {
    setProgramBriefIntro("");
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Завантаження...</div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Курс не знайдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Редагувати згенеровані дані: {course.name}</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-4">
          {/* Discipline Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Питання до дисципліни:</label>
              <button
                onClick={handleResetDisciplineQuestions}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути питання (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {disciplineQuestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {disciplineQuestions.map((q, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-2">
                      <span className="flex-1 text-[#fbf0df]">{q}</span>
                      <button
                        onClick={() => handleRemoveDisciplineQuestion(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDisciplineQuestion}
                  onChange={(e) => setNewDisciplineQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddDisciplineQuestion()}
                  className="flex-1 bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  placeholder="Додати питання"
                />
                <button
                  onClick={handleAddDisciplineQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          </div>

          {/* Self Method Goal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Мета самостійної роботи:</label>
              <button
                onClick={handleResetSelfMethodGoal}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути мету (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={selfMethodGoal}
              onChange={(e) => setSelfMethodGoal(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть мету самостійної роботи"
            />
          </div>

          {/* Self Method Task */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Завдання самостійної роботи:</label>
              <button
                onClick={handleResetSelfMethodTask}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути завдання (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={selfMethodTask}
              onChange={(e) => setSelfMethodTask(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть завдання самостійної роботи"
            />
          </div>

          {/* Self Method General */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Загальна інформація про самостійну роботу:</label>
              <button
                onClick={handleResetSelfMethodGeneral}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути загальну інформацію (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={selfMethodGeneral}
              onChange={(e) => setSelfMethodGeneral(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть загальну інформацію про самостійну роботу"
            />
          </div>

          {/* Self Method Individual Topics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Індивідуальні теми самостійної роботи:</label>
              <button
                onClick={handleResetSelfMethodIndividualTopics}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути теми (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {selfMethodIndividualTopics.length > 0 && (
                <div className="flex flex-col gap-2">
                  {selfMethodIndividualTopics.map((topic, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-2">
                      <span className="flex-1 text-[#fbf0df]">{topic}</span>
                      <button
                        onClick={() => handleRemoveSelfMethodIndividualTopic(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSelfMethodIndividualTopic}
                  onChange={(e) => setNewSelfMethodIndividualTopic(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddSelfMethodIndividualTopic()}
                  className="flex-1 bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  placeholder="Додати тему"
                />
                <button
                  onClick={handleAddSelfMethodIndividualTopic}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          </div>

          {/* Program Goal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Мета програми:</label>
              <button
                onClick={handleResetProgramGoal}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути мету (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programGoal}
              onChange={(e) => setProgramGoal(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть мету програми"
            />
          </div>

          {/* Program Task */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Завдання програми:</label>
              <button
                onClick={handleResetProgramTask}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути завдання (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programTask}
              onChange={(e) => setProgramTask(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть завдання програми"
            />
          </div>

          {/* Program Subject */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Предмет програми:</label>
              <button
                onClick={handleResetProgramSubject}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути предмет (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programSubject}
              onChange={(e) => setProgramSubject(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть предмет програми"
            />
          </div>

          {/* Program Orientation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Орієнтація програми:</label>
              <button
                onClick={handleResetProgramOrientation}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути орієнтацію (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programOrientation}
              onChange={(e) => setProgramOrientation(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть орієнтацію програми"
            />
          </div>

          {/* Program Brief Results */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Короткі результати програми:</label>
              <button
                onClick={handleResetProgramBriefResults}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути результати (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programBriefResults}
              onChange={(e) => setProgramBriefResults(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть короткі результати програми"
            />
          </div>

          {/* Program Brief Skills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Короткі вміння програми:</label>
              <button
                onClick={handleResetProgramBriefSkills}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути вміння (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={5}
              value={programBriefSkills}
              onChange={(e) => setProgramBriefSkills(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть короткі вміння програми"
            />
          </div>

          {/* Program Intro */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Вступ до програми:</label>
              <button
                onClick={handleResetProgramIntro}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути вступ (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={10}
              value={programIntro}
              onChange={(e) => setProgramIntro(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть вступ до програми"
            />
          </div>

          {/* Program Brief Intro */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[#fbf0df] font-bold">Короткий вступ до програми:</label>
              <button
                onClick={handleResetProgramBriefIntro}
                className="text-yellow-400 hover:text-yellow-300 opacity-60 hover:opacity-100 transition-opacity"
                title="Скинути короткий вступ (буде згенеровано автоматично)"
              >
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
            </div>
            <textarea
              rows={10}
              value={programBriefIntro}
              onChange={(e) => setProgramBriefIntro(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть короткий вступ до програми"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              {isSaving ? "Збереження..." : "Зберегти"}
            </button>
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

