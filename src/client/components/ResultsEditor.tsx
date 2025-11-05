import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import type { CourseResult } from "@/stores/models";

interface ResultsEditorProps {
  label: string;
  selectedResults: CourseResult[];
  availableResults: CourseResult[];
  onAdd: (resultId: string) => void;
  onRemove: (resultId: number) => void;
}

export default function ResultsEditor({
  label,
  selectedResults,
  availableResults,
  onAdd,
  onRemove
}: ResultsEditorProps) {
  return (
    <div className="col-span-2">
      <label className="block text-[#fbf0df] font-bold mb-2">{label}:</label>
      <div className="flex flex-col gap-2">
        {selectedResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedResults.map((result) => (
              <div
                key={result.id}
                className="bg-[#2a2a2a] border border-[#fbf0df] rounded-lg px-3 py-1.5 flex items-center gap-2"
              >
                <span className="text-[#fbf0df] font-mono text-sm">
                  <span className="font-bold text-[#f3d5a3]">{result.no}.</span> {result.name}
                </span>
                <button
                  onClick={() => onRemove(result.id)}
                  className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                  aria-label={`Видалити ${label}`}
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
              onAdd(e.target.value);
              e.target.value = "";
            }
          }}
        >
          <option value="">-- Додати {label} --</option>
          {availableResults.map(result => (
            <option key={result.id} value={result.id}>
              {result.no}. {result.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

