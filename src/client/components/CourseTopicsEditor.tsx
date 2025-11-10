import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faTimes, faGripVertical, faEdit } from "@fortawesome/free-solid-svg-icons";
import { Reorder, useDragControls } from "motion/react";
import type { CourseTopic } from "@/stores/models";
import InPlaceEditor from "./InPlaceEditor";

interface CourseTopicsEditorProps {
  courseId: number;
}

interface TopicItemProps {
  topic: CourseTopic;
  courseId: number;
  bgColor: string;
  onEdit: (topic: CourseTopic) => void;
  onDelete: (id: number) => void;
  onUpdateAttestation: (topic: CourseTopic, newAttestation: number) => void;
  onUpdateFulltimeHours: (topic: CourseTopic, newHours: number) => void;
  onUpdatePracticalHours: (topic: CourseTopic, newHours: number) => void;
  onUpdateFulltimeSrsHours: (topic: CourseTopic, newHours: number) => void;
  onUpdateInabscentiaHours: (topic: CourseTopic, newHours: number) => void;
  onUpdateInabscentiaPracticalHours: (topic: CourseTopic, newHours: number) => void;
  onUpdateInabscentiaSrsHours: (topic: CourseTopic, newHours: number) => void;
}

function TopicItem({
  topic,
  courseId,
  bgColor,
  onEdit,
  onDelete,
  onUpdateAttestation,
  onUpdateFulltimeHours,
  onUpdatePracticalHours,
  onUpdateFulltimeSrsHours,
  onUpdateInabscentiaHours,
  onUpdateInabscentiaPracticalHours,
  onUpdateInabscentiaSrsHours,
}: TopicItemProps) {
  const navigate = useNavigate();
  const dragControls = useDragControls();
  
  const attestation = topic.data?.attestation || 1;
  const hours = topic.data?.fulltime?.hours || 2;
  const practicalHours = topic.data?.fulltime?.practical_hours || 0;
  const srsHours = topic.data?.fulltime?.srs_hours || 0;
  const inabscentiaHours = topic.data?.inabscentia?.hours || 0;
  const inabscentiaPracticalHours = topic.data?.inabscentia?.practical_hours || 0;
  const inabscentiaSrsHours = topic.data?.inabscentia?.srs_hours || 0;

  return (
    <Reorder.Item
      value={topic}
      className={`${bgColor} border border-[#fbf0df] rounded-lg p-3 flex flex-col gap-2 transition-colors`}
      style={{ cursor: 'default' }}
      dragListener={false}
      dragControls={dragControls}
    >
      <div className="flex items-start justify-between gap-2 flex-col sm:flex-row">
        <div className="flex items-start gap-2 flex-1 min-w-0 w-full">
          <div 
            className="mt-1 text-[#fbf0df] opacity-60 cursor-grab active:cursor-grabbing shrink-0 touch-none"
            onPointerDown={(event) => dragControls.start(event)}
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <div className="font-bold text-[#f3d5a3] wrap-break-words min-w-0">
                {topic.index}. {topic.name || `Тема ${topic.index}`}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-[#fbf0df] opacity-70 flex-wrap">
                <InPlaceEditor
                  value={hours}
                  options={[
                    { value: 2, label: "2 год." },
                    { value: 4, label: "4 год." },
                    { value: 6, label: "6 год." },
                    { value: 8, label: "8 год." },
                  ]}
                  displayText={`${hours} год.`}
                  title="Натисніть для зміни годин"
                  onChange={(newHours) => onUpdateFulltimeHours(topic, newHours)}
                />
                <InPlaceEditor
                  value={practicalHours}
                  options={[
                    { value: 0, label: "0 пр." },
                    { value: 2, label: "2 пр." },
                    { value: 4, label: "4 пр." },
                    { value: 6, label: "6 пр." },
                    { value: 8, label: "8 пр." },
                  ]}
                  displayText={`${practicalHours} пр.`}
                  title="Натисніть для зміни практичних годин"
                  onChange={(newPracticalHours) => onUpdatePracticalHours(topic, newPracticalHours)}
                />
                <InPlaceEditor
                  value={srsHours}
                  options={[
                    { value: 0, label: "0 СРС" },
                    { value: 2, label: "2 СРС" },
                    { value: 4, label: "4 СРС" },
                    { value: 5, label: "5 СРС" },
                    { value: 6, label: "6 СРС" },
                    { value: 7, label: "7 СРС" },
                    { value: 8, label: "8 СРС" },
                    { value: 10, label: "10 СРС" },
                    { value: 12, label: "12 СРС" },
                    { value: 14, label: "14 СРС" },
                    { value: 16, label: "16 СРС" },
                    { value: 18, label: "18 СРС" },
                  ]}
                  displayText={`${srsHours} СРС`}
                  title="Натисніть для зміни СРС годин денної форми"
                  onChange={(newSrsHours) => onUpdateFulltimeSrsHours(topic, newSrsHours)}
                />                          
                <InPlaceEditor
                  value={inabscentiaHours}
                  options={[
                    { value: 0, label: "0 год. заоч." },
                    { value: 1, label: "1 год. заоч." },
                    { value: 2, label: "2 год. заоч." },
                    { value: 4, label: "4 год. заоч." },
                    { value: 6, label: "6 год. заоч." },
                    { value: 8, label: "8 год. заоч." },
                  ]}
                  displayText={`${inabscentiaHours} год. заоч.`}
                  title="Натисніть для зміни годин заочної форми"
                  onChange={(newHours) => onUpdateInabscentiaHours(topic, newHours)}
                />
                <InPlaceEditor
                  value={inabscentiaPracticalHours}
                  options={[
                    { value: 0, label: "0 пр. заоч." },
                    { value: 1, label: "1 пр. заоч." },
                    { value: 2, label: "2 пр. заоч." },
                    { value: 4, label: "4 пр. заоч." },
                    { value: 6, label: "6 пр. заоч." },
                    { value: 8, label: "8 пр. заоч." },
                  ]}
                  displayText={`${inabscentiaPracticalHours} пр. заоч.`}
                  title="Натисніть для зміни практичних годин заочної форми"
                  onChange={(newPracticalHours) => onUpdateInabscentiaPracticalHours(topic, newPracticalHours)}
                />
                <InPlaceEditor
                  value={inabscentiaSrsHours}
                  options={[
                    { value: 0, label: "0 СРС заоч." },
                    { value: 2, label: "2 СРС заоч." },
                    { value: 4, label: "4 СРС заоч." },
                    { value: 6, label: "6 СРС заоч." },
                    { value: 8, label: "8 СРС заоч." },
                    { value: 10, label: "10 СРС заоч." },
                    { value: 12, label: "12 СРС заоч." },
                    { value: 14, label: "14 СРС заоч." },
                    { value: 16, label: "16 СРС заоч." },
                    { value: 18, label: "18 СРС заоч." },
                  ]}
                  displayText={`${inabscentiaSrsHours} СРС заоч.`}
                  title="Натисніть для зміни СРС годин заочної форми"
                  onChange={(newSrsHours) => onUpdateInabscentiaSrsHours(topic, newSrsHours)}
                />
                <InPlaceEditor
                  value={attestation}
                  options={[
                    { value: 1, label: "Атест. 1" },
                    { value: 2, label: "Атест. 2" },
                    { value: 3, label: "Атест. 3" },
                    { value: 4, label: "Атест. 4" },
                  ]}
                  displayText={`Атест. ${attestation}`}
                  title="Натисніть для зміни атестації"
                  onChange={(newAttestation) => onUpdateAttestation(topic, newAttestation)}
                />                          
              </div>
            </div>
            <div className="text-sm text-[#fbf0df] opacity-80 whitespace-pre-wrap line-clamp-3 overflow-hidden">
              {topic.lection}
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-4 flex-shrink-0">
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
            onClick={() => onEdit(topic)}
            className="text-[#fbf0df] hover:text-[#f3d5a3] opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
            aria-label="Редагувати тему"
            title="Редагувати тему"
          >
            <FontAwesomeIcon icon={faPen} />
          </button>
          <button
            onClick={() => onDelete(topic.id)}
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
  const [topicSrsHours, setTopicSrsHours] = useState<number>(0);
  const [topicInabscentiaSrsHours, setTopicInabscentiaSrsHours] = useState<number>(0);
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
      data: {
        attestation: 1,
        fulltime: {
          hours: 2,
          practical_hours: 0,
          srs_hours: 0
        },
        inabscentia: {
          hours: 0,
          practical_hours: 0,
          srs_hours: 0
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
    setTopicSrsHours(0);
    setTopicInabscentiaSrsHours(0);
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
    setTopicSrsHours(topic.data?.fulltime?.srs_hours || 0);
    setTopicInabscentiaSrsHours(topic.data?.inabscentia?.srs_hours || 0);
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
    setTopicSrsHours(0);
    setTopicInabscentiaSrsHours(0);
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
            practical_hours: topicPracticalHours,
            srs_hours: topicSrsHours
          },
          inabscentia: {
            hours: topicInabscentiaHours,
            practical_hours: topicInabscentiaPracticalHours,
            srs_hours: topicInabscentiaSrsHours
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
      } else {
        throw new Error("Failed to update attestation");
      }
    } catch (error) {
      console.error("Error updating attestation:", error);
      alert("Не вдалося оновити атестацію");
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
      } else {
        throw new Error("Failed to update fulltime hours");
      }
    } catch (error) {
      console.error("Error updating fulltime hours:", error);
      alert("Не вдалося оновити години");
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
      } else {
        throw new Error("Failed to update practical hours");
      }
    } catch (error) {
      console.error("Error updating practical hours:", error);
      alert("Не вдалося оновити практичні години");
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
      } else {
        throw new Error("Failed to update in absentia hours");
      }
    } catch (error) {
      console.error("Error updating in absentia hours:", error);
      alert("Не вдалося оновити години заочної форми");
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
      } else {
        throw new Error("Failed to update in absentia practical hours");
      }
    } catch (error) {
      console.error("Error updating in absentia practical hours:", error);
      alert("Не вдалося оновити практичні години заочної форми");
    }
  };

  const handleUpdateFulltimeSrsHours = async (topic: CourseTopic, newSrsHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          fulltime: {
            ...topic.data?.fulltime,
            srs_hours: newSrsHours
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
      } else {
        throw new Error("Failed to update fulltime SRS hours");
      }
    } catch (error) {
      console.error("Error updating fulltime SRS hours:", error);
      alert("Не вдалося оновити СРС години денної форми");
    }
  };

  const handleUpdateInabscentiaSrsHours = async (topic: CourseTopic, newSrsHours: number) => {
    try {
      const updatedTopic: CourseTopic = {
        ...topic,
        data: {
          ...topic.data,
          inabscentia: {
            ...topic.data?.inabscentia,
            srs_hours: newSrsHours
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
      } else {
        throw new Error("Failed to update in absentia SRS hours");
      }
    } catch (error) {
      console.error("Error updating in absentia SRS hours:", error);
      alert("Не вдалося оновити СРС години заочної форми");
    }
  };

  return (
    <div className="bg-[#1a1a1a] border-2 border-[#fbf0df] rounded-xl p-3 font-mono flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[#fbf0df] font-bold text-lg">Теми курсу:</h2>
        <button
          onClick={handleAddTopic}
          className="text-[#fbf0df] hover:text-[#f3d5a3] px-3 py-1.5 rounded-lg font-bold flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPlus} />
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
                        <label className="block text-[#fbf0df] font-bold mb-2">СРС год. (денна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicSrsHours}
                          onChange={(e) => setTopicSrsHours(Number(e.target.value))}
                        >
                          <option value={0}>0 годин</option>
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                          <option value={10}>10 годин</option>
                          <option value={12}>12 годин</option>
                          <option value={14}>14 годин</option>
                          <option value={16}>16 годин</option>
                          <option value={18}>18 годин</option>
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
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#fbf0df] font-bold mb-2">СРС год. (заочна):</label>
                        <select
                          className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                          value={topicInabscentiaSrsHours}
                          onChange={(e) => setTopicInabscentiaSrsHours(Number(e.target.value))}
                        >
                          <option value={0}>0 годин</option>
                          <option value={2}>2 години</option>
                          <option value={4}>4 години</option>
                          <option value={6}>6 годин</option>
                          <option value={8}>8 годин</option>
                          <option value={10}>10 годин</option>
                          <option value={12}>12 годин</option>
                          <option value={14}>14 годин</option>
                          <option value={16}>16 годин</option>
                          <option value={18}>18 годин</option>
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
            // Background colors based on attestation index
            const attestationBgColors = {
              1: "bg-[#2a2a2a]", // Default dark gray
              2: "bg-[#2a2a3a]", // Slightly blue-tinted
              3: "bg-[#3a2a2a]", // Slightly red-tinted
              4: "bg-[#2a3a2a]"  // Slightly green-tinted
            };
            const bgColor = attestationBgColors[attestation as keyof typeof attestationBgColors] || attestationBgColors[1];
            
            return (
              <TopicItem
                key={topic.id}
                topic={topic}
                courseId={courseId}
                bgColor={bgColor}
                onEdit={handleEditTopic}
                onDelete={handleDeleteTopic}
                onUpdateAttestation={handleUpdateAttestation}
                onUpdateFulltimeHours={handleUpdateFulltimeHours}
                onUpdatePracticalHours={handleUpdatePracticalHours}
                onUpdateFulltimeSrsHours={handleUpdateFulltimeSrsHours}
                onUpdateInabscentiaHours={handleUpdateInabscentiaHours}
                onUpdateInabscentiaPracticalHours={handleUpdateInabscentiaPracticalHours}
                onUpdateInabscentiaSrsHours={handleUpdateInabscentiaSrsHours}
              />
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
                <label className="block text-[#fbf0df] font-bold mb-2">СРС год. (денна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicSrsHours}
                  onChange={(e) => setTopicSrsHours(Number(e.target.value))}
                >
                  <option value={0}>0 годин</option>
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                  <option value={10}>10 годин</option>
                  <option value={12}>12 годин</option>
                  <option value={14}>14 годин</option>
                  <option value={16}>16 годин</option>
                  <option value={18}>18 годин</option>
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[#fbf0df] font-bold mb-2">СРС год. (заочна):</label>
                <select
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
                  value={topicInabscentiaSrsHours}
                  onChange={(e) => setTopicInabscentiaSrsHours(Number(e.target.value))}
                >
                  <option value={0}>0 годин</option>
                  <option value={2}>2 години</option>
                  <option value={4}>4 години</option>
                  <option value={6}>6 годин</option>
                  <option value={8}>8 годин</option>
                  <option value={10}>10 годин</option>
                  <option value={12}>12 годин</option>
                  <option value={14}>14 годин</option>
                  <option value={16}>16 годин</option>
                  <option value={18}>18 годин</option>
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

