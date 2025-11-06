import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { CourseTopic, QuizQuestion } from "@/stores/models";
import toast from "react-hot-toast";
import QuizEditor from "../components/QuizEditor";

export default function TopicGeneratedDataEdit() {
  const { courseId, topicId } = useParams<{ courseId: string; topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<CourseTopic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [subtopics, setSubtopics] = useState("");
  const [keywords, setKeywords] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [referats, setReferats] = useState<string[]>([]);
  const [newReferat, setNewReferat] = useState("");
  const [keyQuestions, setKeyQuestions] = useState<string[]>([]);
  const [newKeyQuestion, setNewKeyQuestion] = useState("");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (courseId && topicId) {
      fetchTopic();
    }
  }, [courseId, topicId]);

  const fetchTopic = async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`);
      if (!response.ok) {
        throw new Error("Failed to load topic");
      }
      const data = await response.json() as CourseTopic;
      setTopic(data);

      // Initialize form state from generated data
      const generated = data.generated || {
        subtopics: [],
        keywords: [],
        topics: [],
        referats: [],
        keyQuestions: [],
        quiz: []
      };

      setSubtopics(generated.subtopics?.join("\n") || "");
      setKeywords(generated.keywords?.join(", ") || "");
      setTopics(generated.topics || []);
      setReferats(generated.referats || []);
      setKeyQuestions(generated.keyQuestions || []);
      setQuiz(generated.quiz || []);
    } catch (error) {
      console.error("Error fetching topic:", error);
      toast.error("Помилка завантаження теми");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!topic) return;

    setIsSaving(true);
    try {
      // Parse form data
      const subtopicsArray = subtopics.split("\n").filter(s => s.trim() !== "");
      const keywordsArray = keywords.split(",").map(k => k.trim()).filter(k => k !== "");

      const updatedGenerated = {
        ...topic.generated,
        subtopics: subtopicsArray,
        keywords: keywordsArray,
        topics,
        referats,
        keyQuestions,
        quiz
      };

      const updatedTopic: CourseTopic = {
        ...topic,
        generated: updatedGenerated
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedTopic)
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      toast.success("Дані успішно збережено");
      navigate(`/courses/${courseId}`);
    } catch (error) {
      console.error("Error saving topic:", error);
      toast.error("Помилка збереження даних");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTopic = () => {
    if (newTopic.trim()) {
      setTopics([...topics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const handleRemoveTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const handleAddReferat = () => {
    if (newReferat.trim()) {
      setReferats([...referats, newReferat.trim()]);
      setNewReferat("");
    }
  };

  const handleRemoveReferat = (index: number) => {
    setReferats(referats.filter((_, i) => i !== index));
  };

  const handleAddKeyQuestion = () => {
    if (newKeyQuestion.trim()) {
      setKeyQuestions([...keyQuestions, newKeyQuestion.trim()]);
      setNewKeyQuestion("");
    }
  };

  const handleRemoveKeyQuestion = (index: number) => {
    setKeyQuestions(keyQuestions.filter((_, i) => i !== index));
  };

  const handleQuizChange = (updatedQuiz: QuizQuestion[]) => {
    setQuiz(updatedQuiz);
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

  if (!topic) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
          <div className="text-[#fbf0df] font-mono">Тема не знайдена</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-4">
        <h1 className="font-mono">Редагувати згенеровані дані: {topic.name}</h1>

        <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-4">
          {/* Subtopics */}
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Підтеми з програми (по одній на рядок):</label>
            <textarea
              rows={5}
              value={subtopics}
              onChange={(e) => setSubtopics(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть підтеми, по одній на рядок"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Перелік термінів для методички з самостійної роботи (через кому):</label>
            <textarea
              rows={3}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Введіть ключові слова через кому"
            />
          </div>

          {/* Topics */}
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Теми для самостійної роботи:</label>
            <div className="flex flex-col gap-2">
              {topics.length > 0 && (
                <div className="flex flex-col gap-2">
                  {topics.map((t, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-2">
                      <span className="flex-1 text-[#fbf0df]">{t}</span>
                      <button
                        onClick={() => handleRemoveTopic(index)}
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
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTopic()}
                  className="flex-1 bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  placeholder="Додати тему"
                />
                <button
                  onClick={handleAddTopic}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          </div>

          {/* Referats */}
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Теми рефератів:</label>
            <div className="flex flex-col gap-2">
              {referats.length > 0 && (
                <div className="flex flex-col gap-2">
                  {referats.map((r, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-2">
                      <span className="flex-1 text-[#fbf0df]">{r}</span>
                      <button
                        onClick={() => handleRemoveReferat(index)}
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
                  value={newReferat}
                  onChange={(e) => setNewReferat(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddReferat()}
                  className="flex-1 bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  placeholder="Додати реферат"
                />
                <button
                  onClick={handleAddReferat}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          </div>

          {/* Key Questions */}
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Ключові питання:</label>
            <div className="flex flex-col gap-2">
              {keyQuestions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {keyQuestions.map((q, index) => (
                    <div key={index} className="flex items-center gap-2 bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-2">
                      <span className="flex-1 text-[#fbf0df]">{q}</span>
                      <button
                        onClick={() => handleRemoveKeyQuestion(index)}
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
                  value={newKeyQuestion}
                  onChange={(e) => setNewKeyQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddKeyQuestion()}
                  className="flex-1 bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  placeholder="Додати питання"
                />
                <button
                  onClick={handleAddKeyQuestion}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                >
                  <FontAwesomeIcon icon={faPlus} />
                </button>
              </div>
            </div>
          </div>

          {/* Quiz */}
          <QuizEditor quiz={quiz} onQuizChange={handleQuizChange} />

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

