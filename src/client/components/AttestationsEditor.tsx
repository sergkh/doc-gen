import { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faPlus } from "@fortawesome/free-solid-svg-icons";

export type Attestation = {
  name: string,
  semester: number
};

interface AttestationsEditorProps {
  attestations: Attestation[];
  onAdd: (name: string, semester: number) => void;
  onUpdateSemester: (index: number, semester: number) => void;
  onRemove: (index: number) => void;
}

export default function AttestationsEditor({
  attestations,
  onAdd,
  onUpdateSemester,
  onRemove
}: AttestationsEditorProps) {
  const attestationInputRef = useRef<HTMLInputElement>(null);
  const attestationSemesterRef = useRef<HTMLSelectElement>(null);

  const handleAdd = () => {
    if (attestationInputRef.current && attestationInputRef.current.value.trim()) {
      const semester = attestationSemesterRef.current?.value ? Number(attestationSemesterRef.current.value) : 1;
      onAdd(attestationInputRef.current.value, semester);
      attestationInputRef.current.value = '';
      if (attestationSemesterRef.current) {
        attestationSemesterRef.current.value = '1';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      const semester = attestationSemesterRef.current?.value ? Number(attestationSemesterRef.current.value) : 1;
      onAdd(e.currentTarget.value, semester);
      e.currentTarget.value = '';
      if (attestationSemesterRef.current) {
        attestationSemesterRef.current.value = '1';
      }
    }
  };

  return (
    <div className="col-span-2">
      <label className="block text-amber-50 font-bold mb-2">Атестації:</label>
      <div className="flex flex-col gap-2">
        {attestations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attestations.map((attestation, index) => (
              <div
                key={index}
                className="bg-zinc-800 border border-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-2"
              >
                <span className="text-amber-50 font-mono text-sm">{attestation.name}</span>
                <select
                  value={attestation.semester || 1}
                  onChange={(e) => onUpdateSemester(index, Number(e.target.value))}
                  className="bg-zinc-900 border border-amber-50 text-amber-50 font-mono text-xs px-2 py-0.5 rounded outline-none focus:text-white"
                >
                  <option value={1}>1 семестр</option>
                  <option value={2}>2 семестр</option>
                </select>
                <button
                  onClick={() => onRemove(index)}
                  className="bg-gray-600 hover:bg-gray-700 text-white rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 hover:scale-110 cursor-pointer"
                  aria-label="Видалити атестацію"
                >
                  <FontAwesomeIcon icon={faTimes} size="xs" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={attestationInputRef}
            type="text"
            className="flex-1 bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
            placeholder="Назва атестації"
            onKeyDown={handleKeyDown}
          />
          <select
            ref={attestationSemesterRef}
            defaultValue="1"
            className="bg-transparent border border-amber-50 text-amber-50 font-mono text-base py-1.5 px-2 rounded outline-none focus:text-white"
          >
            <option value="1">1 семестр</option>
            <option value="2">2 семестр</option>
          </select>
          <button
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} /> Додати
          </button>
        </div>
      </div>
    </div>
  );
}

