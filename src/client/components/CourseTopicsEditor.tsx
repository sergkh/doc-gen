import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faTimes, faGripVertical, faEdit } from "@fortawesome/free-solid-svg-icons";
import { Reorder } from "motion/react";
import type { CourseTopic } from "@/stores/models";

interface CourseTopicsEditorProps {
  courseId: number;
}

export default function CourseTopicsEditor({ courseId }: CourseTopicsEditorProps) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicSubtopics, setTopicSubtopics] = useState("");
  const [topicLection, setTopicLection] = useState("");
  const [topicHours, setTopicHours] = useState<number>(2);
  const [topicAttestation, setTopicAttestation] = useState<number>(1);
  const [topicPracticalHours, setTopicPracticalHours] = useState<number>(2);
  const [topicInabscentiaHours, setTopicInabscentiaHours] = useState<number>(0);
  const [topicInabscentiaPracticalHours, setTopicInabscentiaPracticalHours] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [editingAttestationId, setEditingAttestationId] = useState<number | null>(null);
  const [editingFulltimeHoursId, setEditingFulltimeHoursId] = useState<number | null>(null);
  const [editingPracticalHoursId, setEditingPracticalHoursId] = useState<number | null>(null);
  const [editingInabscentiaHoursId, setEditingInabscentiaHoursId] = useState<number | null>(null);
  const [editingInabscentiaPracticalHoursId, setEditingInabscentiaPracticalHoursId] = useState<number | null>(null);

  useEffect(() => {
    if (courseId) {
      fetchTopics(courseId);
    }
  }, [courseId]);

  const fetchTopics = async (courseId: number) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/topics`);
      if (response.ok) {
        const data = await response.json() as CourseTopic[];
        setTopics(data);
      }
    } catch (error) {
      console.error("Error fetching topics:", error);
    }
  };

  const handleAddTopic = () => {
    setEditingTopic({
      id: 0,
      course_id: courseId,
      index: topics.length + 1,
      name: "",
      lection: "",
      data: {
        attestation: 1,
        fulltime: {
          hours: 2,
          practical_hours: 0
        },
        inabscentia: {
          hours: 0,
          practical_hours: 0
        }
      },
      generated: null
    });
    setTopicName("");
    setTopicSubtopics("");
    setTopicLection("");
    setTopicHours(2);
    setTopicAttestation(1);
    setTopicPracticalHours(2);
    setTopicInabscentiaHours(0);
    setTopicInabscentiaPracticalHours(0);
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setTopicName(topic.name || "");
    const subtopics = topic.generated?.subtopics || [];
    setTopicSubtopics(subtopics.join("\n"));
    setTopicLection(topic.lection || "");
    setTopicHours(topic.data?.fulltime?.hours || 2);
    setTopicAttestation(topic.data?.attestation || 1);
    setTopicPracticalHours(topic.data?.fulltime?.practical_hours || 0);
    setTopicInabscentiaHours(topic.data?.inabscentia?.hours || 0);
    setTopicInabscentiaPracticalHours(topic.data?.inabscentia?.practical_hours || 0);
  };

  const handleCancelEdit = () => {
    setEditingTopic(null);
    setTopicName("");
    setTopicSubtopics("");
    setTopicLection("");
    setTopicHours(2);
    setTopicAttestation(1);
    setTopicPracticalHours(0);
    setTopicInabscentiaHours(0);
    setTopicInabscentiaPracticalHours(0);
  };

  const handleSaveTopic = async () => {
    if (!editingTopic) return;
    if (!topicName.trim() || !topicLection.trim()) {
      alert("Назва та текст лекції обов'язкові");
      return;
    }

    try {
      const subtopicsArray = topicSubtopics
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const existingGenerated = editingTopic.generated;
      const topicData: CourseTopic = {
        ...editingTopic,
        name: topicName.trim(),
        lection: topicLection.trim(),
        data: {
          attestation: topicAttestation,
          fulltime: {
            hours: topicHours,
            practical_hours: topicPracticalHours
          },
          inabscentia: {
            hours: topicInabscentiaHours,
            practical_hours: topicInabscentiaPracticalHours
          }
        },
        generated: {
          subtopics: subtopicsArray,
          keywords: existingGenerated?.keywords || [],
          topics: existingGenerated?.topics || [],
          referats: existingGenerated?.referats || [],
          quiz: existingGenerated?.quiz || [],
          keyQuestions: existingGenerated?.keyQuestions || [],
          ...(existingGenerated || {})
        }
      };

      let response;
      if (editingTopic.id === 0) {
        // Create new topic
        response = await fetch(`/api/courses/${courseId}/topics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicData),
        });
      } else {
        // Update existing topic
        response = await fetch(`/api/courses/${courseId}/topics/${editingTopic.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicData),
        });
      }

      if (response.ok) {
        await fetchTopics(courseId);
        handleCancelEdit();
      } else {
        throw new Error("Failed to save topic");
      }
    } catch (error) {
      console.error("Error saving topic:", error);
      alert("Не вдалося зберегти тему");
    }
  };

  const handleDeleteTopic = async (topicId: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цю тему?")) return;

    try {
      const response = await fetch(`/api/courses/${courseId}/topics/${topicId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTopics(courseId);
      } else {
        throw new Error("Failed to delete topic");
      }
    } catch (error) {
      console.error("Error deleting topic:", error);
      alert("Не вдалося видалити тему");
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      const isTextFile = 
        file.type === "text/plain" || 
        fileName.endsWith(".txt") || 
        fileName.endsWith(".text") ||
        file.type.startsWith("text/");

      if (isTextFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setTopicLection(content);
        };
        reader.onerror = () => {
          alert("Помилка читання файлу. Будь ласка, спробуйте ще раз.");
        };
        reader.readAsText(file);
      } else {
        alert("Будь ласка, перетягніть текстовий файл (.txt)");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleReorder = async (newOrder: CourseTopic[]) => {
    // Update local state immediately for responsive UI
    setTopics(newOrder);
    
    // Extract topic IDs in the new order
    const topicIds = newOrder.map(topic => topic.id);
    
    // Send reorder request to server
    try {
      const response = await fetch(`/api/courses/${courseId}/topics/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topicIds),
      });

      if (!response.ok) {
        throw new Error("Failed to reorder topics");
      }
      
      // Refresh topics to ensure sync with server
      await fetchTopics(courseId);
    } catch (error) {
      console.error("Error reordering topics:", error);
      // Revert to previous order on error
      await fetchTopics(courseId);
      alert("Не вдалося зберегти порядок тем");
    }
  };

  const handleUpdateAttestation = async (topic: CourseTopic, newAttestation: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          attestation: newAttestation
        }
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTopic),
      });

      if (response.ok) {
        await fetchTopics(courseId);
        setEditingAttestationId(null);
      } else {
        throw new Error("Failed to update attestation");
      }
    } catch (error) {
      console.error("Error updating attestation:", error);
      alert("Не вдалося оновити атестацію");
      setEditingAttestationId(null);
    }
  };

  const handleUpdateFulltimeHours = async (topic: CourseTopic, newHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          fulltime: {
            ...topic.data?.fulltime,
            hours: newHours
          }
        }
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTopic),
      });

      if (response.ok) {
        await fetchTopics(courseId);
        setEditingFulltimeHoursId(null);
      } else {
        throw new Error("Failed to update fulltime hours");
      }
    } catch (error) {
      console.error("Error updating fulltime hours:", error);
      alert("Не вдалося оновити години");
      setEditingFulltimeHoursId(null);
    }
  };

  const handleUpdatePracticalHours = async (topic: CourseTopic, newPracticalHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          fulltime: {
            ...topic.data?.fulltime,
            practical_hours: newPracticalHours
          }
        }
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTopic),
      });

      if (response.ok) {
        await fetchTopics(courseId);
        setEditingPracticalHoursId(null);
      } else {
        throw new Error("Failed to update practical hours");
      }
    } catch (error) {
      console.error("Error updating practical hours:", error);
      alert("Не вдалося оновити практичні години");
      setEditingPracticalHoursId(null);
    }
  };

  const handleUpdateInabscentiaHours = async (topic: CourseTopic, newHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          inabscentia: {
            ...topic.data?.inabscentia,
            hours: newHours
          }
        }
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTopic),
      });

      if (response.ok) {
        await fetchTopics(courseId);
        setEditingInabscentiaHoursId(null);
      } else {
        throw new Error("Failed to update in absentia hours");
      }
    } catch (error) {
      console.error("Error updating in absentia hours:", error);
      alert("Не вдалося оновити години заочної форми");
      setEditingInabscentiaHoursId(null);
    }
  };

  const handleUpdateInabscentiaPracticalHours = async (topic: CourseTopic, newPracticalHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          inabscentia: {
            ...topic.data?.inabscentia,
            practical_hours: newPracticalHours
          }
        }
      };

      const response = await fetch(`/api/courses/${courseId}/topics/${topic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTopic),
      });

      if (response.ok) {
        await fetchTopics(courseId);
        setEditingInabscentiaPracticalHoursId(null);
      } else {
        throw new Error("Failed to update in absentia practical hours");
      }
    } catch (error) {
      console.error("Error updating in absentia practical hours:", error);
      alert("Не вдалося оновити практичні години заочної форми");
      setEditingInabscentiaPracticalHoursId(null);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[#fbf0df] font-bold text-lg">Теми курсу:</h2>
        <button
          onClick={handleAddTopic}
          className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1.5 rounded-lg font-bold flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} /> Додати тему
        </button>
      </div>

      {topics.length === 0 && !editingTopic ? (
        <div className="text-[#fbf0df] opacity-60">Немає тем</div>
      ) : (
        <Reorder.Group
          axis="y"
          values={topics}
          onReorder={handleReorder}
          className="flex flex-col gap-3"
        >
          {topics.map((topic) => {
            // If this topic is being edited, show the editor instead
            if (editingTopic && editingTopic.id === topic.id) {
              return (
                <div
                  key={topic.id}
                  className="bg-[#2a2a2a] border-2 border-[#f3d5a3] rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#fbf0df] font-bold">
                      Редагувати тему
                    </h3>
                    <button
                      onClick={handleCancelEdit}
                      className="text-[#fbf0df] hover:text-white"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[#fbf0df] font-bold mb-2">Назва теми:</label>
                    <input
                      className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                      value={topicName}
                      onChange={(e) => setTopicName(e.target.value)}
                      placeholder="Введіть назву теми"
                    />
                  </div>
                  <div>
                    <label className="block text-[#fbf0df] font-bold mb-2">Підтеми (по одній на рядок):</label>
                    <textarea
                      rows={3}
                      className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
                      value={topicSubtopics}
                      onChange={(e) => setTopicSubtopics(e.target.value)}
                      placeholder="Введіть підтеми, по одній на рядок"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">Години (денна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicHours}
                          onChange={(e) => setTopicHours(Number(e.target.value))}
                        >
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">Практ. год. (денна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicPracticalHours}
                          onChange={(e) => setTopicPracticalHours(Number(e.target.value))}
                        >
                          <option value={0}>0 годин</option>
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">Години (заочна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicInabscentiaHours}
                          onChange={(e) => setTopicInabscentiaHours(Number(e.target.value))}
                        >
                          <option value={0}>0 годин</option>
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">Практ. год. (заочна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicInabscentiaPracticalHours}
                          onChange={(e) => setTopicInabscentiaPracticalHours(Number(e.target.value))}
                        >
                          <option value={0}>0 годин</option>
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">Атестація:</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicAttestation}
                          onChange={(e) => setTopicAttestation(Number(e.target.value))}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#fbf0df] font-bold mb-2">Текст лекції:</label>
                    <textarea
                      rows={5}
                      onDrop={handleFileDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y transition-colors duration-200 ${
                        isDragging ? "bg-[#2a2a2a] border-[#f3d5a3] border-dashed" : ""
                      }`}
                      value={topicLection}
                      onChange={(e) => setTopicLection(e.target.value)}
                      placeholder={isDragging ? "Відпустіть файл тут..." : "Введіть текст лекції (або перетягніть .txt файл)"}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTopic}
                      className="bg-green-600 hover:bg-green-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                    >
                      Зберегти
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              );
            }
            
            // Otherwise show the normal topic item
            const attestation = topic.data?.attestation || 1;
            const hours = topic.data?.fulltime?.hours || 2;
            const practicalHours = topic.data?.fulltime?.practical_hours || 0;
            const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
            const inabscentiaPracticalHours = topic.data?.inabscentia?.practical_hours || 0;
            // Background colors based on attestation index
            const attestationBgColors = {
              1: "bg-[#2a2a2a]", // Default dark gray
              2: "bg-[#2a2a3a]", // Slightly blue-tinted
              3: "bg-[#3a2a2a]", // Slightly red-tinted
              4: "bg-[#2a3a2a]"  // Slightly green-tinted
            };
            const bgColor = attestationBgColors[attestation as keyof typeof attestationBgColors] || attestationBgColors[1];
            
            return (
              <Reorder.Item
                key={topic.id}
                value={topic}
                className={`${bgColor} border border-[#fbf0df] rounded-lg p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-1 text-[#fbf0df] opacity-60 cursor-grab active:cursor-grabbing">
                      <FontAwesomeIcon icon={faGripVertical} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-[#f3d5a3]">
                          {topic.index}. {topic.name || `Тема ${topic.index}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#fbf0df] opacity-70 flex-wrap">
                          {editingFulltimeHoursId === topic.id ? (
                            <select
                              value={hours}
                              onChange={(e) => {
                                const newHours = Number(e.target.value);
                                handleUpdateFulltimeHours(topic, newHours);
                              }}
                              onBlur={() => setEditingFulltimeHoursId(null)}
                              autoFocus
                              className="bg-[#1a1a1a] border border-[#fbf0df] text-[#fbf0df] font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={2}>2 год.</option>
                              <option value={4}>4 год.</option>
                              <option value={6}>6 год.</option>
                              <option value={8}>8 год.</option>
                            </select>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFulltimeHoursId(topic.id);
                              }}
                              className="bg-[#1a1a1a] px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                              title="Натисніть для зміни годин"
                            >
                              {hours} год.
                            </button>
                          )}
                          {editingPracticalHoursId === topic.id ? (
                            <select
                              value={practicalHours}
                              onChange={(e) => {
                                const newPracticalHours = Number(e.target.value);
                                handleUpdatePracticalHours(topic, newPracticalHours);
                              }}
                              onBlur={() => setEditingPracticalHoursId(null)}
                              autoFocus
                              className="bg-[#1a1a1a] border border-[#fbf0df] text-[#fbf0df] font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={0}>0 пр.</option>
                              <option value={2}>2 пр.</option>
                              <option value={4}>4 пр.</option>
                              <option value={6}>6 пр.</option>
                              <option value={8}>8 пр.</option>
                            </select>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPracticalHoursId(topic.id);
                              }}
                              className="bg-[#1a1a1a] px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                              title="Натисніть для зміни практичних годин"
                            >
                              {practicalHours} пр.
                            </button>
                          )}
                          {editingInabscentiaHoursId === topic.id ? (
                            <select
                              value={inabscentiaHours}
                              onChange={(e) => {
                                const newHours = Number(e.target.value);
                                handleUpdateInabscentiaHours(topic, newHours);
                              }}
                              onBlur={() => setEditingInabscentiaHoursId(null)}
                              autoFocus
                              className="bg-[#1a1a1a] border border-[#fbf0df] text-[#fbf0df] font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={0}>0 год. заоч.</option>
                              <option value={2}>2 год. заоч.</option>
                              <option value={4}>4 год. заоч.</option>
                              <option value={6}>6 год. заоч.</option>
                              <option value={8}>8 год. заоч.</option>
                            </select>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInabscentiaHoursId(topic.id);
                              }}
                              className="bg-[#1a1a1a] px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                              title="Натисніть для зміни годин заочної форми"
                            >
                              {inabscentiaHours} год. заоч.
                            </button>
                          )}
                          {editingInabscentiaPracticalHoursId === topic.id ? (
                            <select
                              value={inabscentiaPracticalHours}
                              onChange={(e) => {
                                const newPracticalHours = Number(e.target.value);
                                handleUpdateInabscentiaPracticalHours(topic, newPracticalHours);
                              }}
                              onBlur={() => setEditingInabscentiaPracticalHoursId(null)}
                              autoFocus
                              className="bg-[#1a1a1a] border border-[#fbf0df] text-[#fbf0df] font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={0}>0 пр. заоч.</option>
                              <option value={2}>2 пр. заоч.</option>
                              <option value={4}>4 пр. заоч.</option>
                              <option value={6}>6 пр. заоч.</option>
                              <option value={8}>8 пр. заоч.</option>
                            </select>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingInabscentiaPracticalHoursId(topic.id);
                              }}
                              className="bg-[#1a1a1a] px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                              title="Натисніть для зміни практичних годин заочної форми"
                            >
                              {inabscentiaPracticalHours} пр. заоч.
                            </button>
                          )}
                          {editingAttestationId === topic.id ? (
                            <select
                              value={attestation}
                              onChange={(e) => {
                                const newAttestation = Number(e.target.value);
                                handleUpdateAttestation(topic, newAttestation);
                              }}
                              onBlur={() => setEditingAttestationId(null)}
                              autoFocus
                              className="bg-[#1a1a1a] border border-[#fbf0df] text-[#fbf0df] font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value={1}>Атест. 1</option>
                              <option value={2}>Атест. 2</option>
                              <option value={3}>Атест. 3</option>
                              <option value={4}>Атест. 4</option>
                            </select>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingAttestationId(topic.id);
                              }}
                              className="bg-[#1a1a1a] px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                              title="Натисніть для зміни атестації"
                            >
                              Атест. {attestation}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-[#fbf0df] opacity-80 whitespace-pre-wrap line-clamp-3 overflow-hidden">
                        {topic.lection}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {topic.generated && (
                      <button
                        onClick={() => navigate(`/courses/${courseId}/topics/${topic.id}/generated`)}
                        className="text-[#fbf0df] hover:text-blue-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                        aria-label="Редагувати згенеровані дані"
                        title="Редагувати згенеровані дані"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditTopic(topic)}
                      className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати тему"
                      title="Редагувати тему"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="text-[#fbf0df] hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити тему"
                      title="Видалити тему"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}

      {editingTopic && editingTopic.id === 0 && (
        <div className="bg-[#2a2a2a] border-2 border-[#f3d5a3] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[#fbf0df] font-bold">
              {editingTopic.id === 0 ? "Додати тему" : "Редагувати тему"}
            </h3>
            <button
              onClick={handleCancelEdit}
              className="text-[#fbf0df] hover:text-white"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Назва теми:</label>
            <input
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="Введіть назву теми"
            />
          </div>
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Підтеми (по одній на рядок):</label>
            <textarea
              rows={3}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              value={topicSubtopics}
              onChange={(e) => setTopicSubtopics(e.target.value)}
              placeholder="Введіть підтеми, по одній на рядок"
            />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Години (денна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicHours}
                  onChange={(e) => setTopicHours(Number(e.target.value))}
                >
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                </select>
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Практ. год. (денна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicPracticalHours}
                  onChange={(e) => setTopicPracticalHours(Number(e.target.value))}
                >
                  <option value={0}>0 годин</option>
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                </select>
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Години (заочна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicInabscentiaHours}
                  onChange={(e) => setTopicInabscentiaHours(Number(e.target.value))}
                >
                  <option value={0}>0 годин</option>
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                </select>
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Практ. год. (заочна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicInabscentiaPracticalHours}
                  onChange={(e) => setTopicInabscentiaPracticalHours(Number(e.target.value))}
                >
                  <option value={0}>0 годин</option>
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                </select>
              </div>
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">Атестація:</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicAttestation}
                  onChange={(e) => setTopicAttestation(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[#fbf0df] font-bold mb-2">Текст лекції:</label>
            <textarea
              rows={5}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y transition-colors duration-200 ${
                isDragging ? "bg-[#2a2a2a] border-[#f3d5a3] border-dashed" : ""
              }`}
              value={topicLection}
              onChange={(e) => setTopicLection(e.target.value)}
              placeholder={isDragging ? "Відпустіть файл тут..." : "Введіть текст лекції (або перетягніть .txt файл)"}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveTopic}
              className="bg-green-600 hover:bg-green-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Зберегти
            </button>
            <button
              onClick={handleCancelEdit}
              className="bg-gray-600 hover:bg-gray-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

