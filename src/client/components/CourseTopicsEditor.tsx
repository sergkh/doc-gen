import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faTimes, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import { Reorder } from "motion/react";
import type { CourseTopic } from "@/stores/models";

interface CourseTopicsEditorProps {
  courseId: number;
}

export default function CourseTopicsEditor({ courseId }: CourseTopicsEditorProps) {
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicLection, setTopicLection] = useState("");
  const [isDragging, setIsDragging] = useState(false);

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
      generated: null
    });
    setTopicName("");
    setTopicLection("");
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setTopicName(topic.name || "");
    setTopicLection(topic.lection || "");
  };

  const handleCancelEdit = () => {
    setEditingTopic(null);
    setTopicName("");
    setTopicLection("");
  };

  const handleSaveTopic = async () => {
    if (!editingTopic) return;
    if (!topicName.trim() || !topicLection.trim()) {
      alert("Назва та текст лекції обов'язкові");
      return;
    }

    try {
      const topicData: CourseTopic = {
        ...editingTopic,
        name: topicName.trim(),
        lection: topicLection.trim(),
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

      {topics.length === 0 ? (
        <div className="text-[#fbf0df] opacity-60">Немає тем</div>
      ) : (
        <Reorder.Group
          axis="y"
          values={topics}
          onReorder={handleReorder}
          className="flex flex-col gap-3"
        >
          {topics.map((topic) => (
            <Reorder.Item
              key={topic.id}
              value={topic}
              className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  <div className="mt-1 text-[#fbf0df] opacity-60 cursor-grab active:cursor-grabbing">
                    <FontAwesomeIcon icon={faGripVertical} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#f3d5a3] mb-1">
                      {topic.index}. {topic.name || `Тема ${topic.index}`}
                    </div>
                    <div className="text-sm text-[#fbf0df] opacity-80 whitespace-pre-wrap line-clamp-3 overflow-hidden">
                      {topic.lection}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEditTopic(topic)}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPen} size="xs" /> Редагувати
                  </button>
                  <button
                    onClick={() => handleDeleteTopic(topic.id)}
                    className="bg-red-600 hover:bg-red-700 text-white border-0 px-3 py-1 rounded-lg font-bold flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faTrash} size="xs" /> Видалити
                  </button>
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {editingTopic && (
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

