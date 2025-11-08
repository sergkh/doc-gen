import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { QuizQuestion } from "@/stores/models";

interface QuizEditorProps {
  quiz: QuizQuestion[];
  onQuizChange: (quiz: QuizQuestion[]) => void;
}

export default function QuizEditor({ quiz, onQuizChange }: QuizEditorProps) {
  const handleAddQuestion = () => {
    const newQuestion: QuizQuestion = {
      question: "",
      index: quiz.length + 1,
      options: ["", "", "", ""]
    };
    onQuizChange([...quiz, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = quiz.filter((_, i) => i !== index).map((q, i) => ({
      ...q,
      index: i + 1
    }));
    onQuizChange(updated);
  };

  const handleUpdateQuestion = (index: number, field: keyof QuizQuestion, value: string | string[]) => {
    const updated = quiz.map((q, i) => 
      i === index ? { ...q, [field]: value } : q
    );
    onQuizChange(updated);
  };

  const handleUpdateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = quiz.map((q, i) => {
      if (i === questionIndex) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });
    onQuizChange(updated);
  };

  return (
    <div>
      <div className="flex flex-col gap-4">
        {quiz.map((question, qIndex) => (
          <div key={qIndex} className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[#fbf0df] font-bold">Питання {question.index}:</span>
              <button
                onClick={() => handleRemoveQuestion(qIndex)}
                className="text-red-400 hover:text-red-300"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
            <textarea
              rows={3}
              value={question.question}
              onChange={(e) => handleUpdateQuestion(qIndex, "question", e.target.value)}
              className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white resize-y"
              placeholder="Текст питання"
            />
            <div className="flex flex-col gap-2">
              {question.options.map((option, oIndex) => (
                <input
                  key={oIndex}
                  type="text"
                  value={option}
                  onChange={(e) => handleUpdateOption(qIndex, oIndex, e.target.value)}
                  className="w-full bg-transparent border border-[#fbf0df] text-[#fbf0df] font-mono text-sm py-1 px-2 rounded outline-none focus:text-white"
                  placeholder={`Варіант ${oIndex + 1}`}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={handleAddQuestion}
          className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-2 rounded-lg font-bold flex items-center gap-2 justify-center"
        >
          <FontAwesomeIcon icon={faPlus} /> Додати питання
        </button>
      </div>
    </div>
  );
}

