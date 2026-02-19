import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import type { CourseResult } from "@/stores/models";

interface ResultsEditorProps {
  label: string;
  selectedResults: CourseResult[];
  availableResults: CourseResult[];
  onAdd: (resultId: string) => void;
  onRemove: (resultId: number) => void;
  onAutofill?: () => void;
  autofillLoading?: boolean;
}

export default function ResultsEditor({
  label,
  selectedResults,
  availableResults,
  onAdd,
  onRemove,
  onAutofill,
  autofillLoading
}: ResultsEditorProps) {
  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-amber-50 font-bold">{label}:</label>
        {onAutofill && (
          <button
            type="button"
            onClick={onAutofill}
            disabled={autofillLoading}
            className="flex items-center gap-2 text-amber-50 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-3 py-1 rounded transition-colors text-sm"
            title="Автозаповнення за допомогою AI"
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            {autofillLoading ? "Завантаження..." : "AI"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {selectedResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedResults.map((result) => (
              <div
                key={result.id}
                className="bg-zinc-800 border border-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-2"
              >
                <span className="text-amber-50 font-mono text-sm">
                  <span className="font-bold text-amber-200">{result.no}.</span> {result.name}
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
          className="w-full bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
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

