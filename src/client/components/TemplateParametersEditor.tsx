import type { TemplateParameter } from "@/stores/models";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

interface TemplateParametersEditorProps {
  parameters: TemplateParameter[];
  onChange: (parameters: TemplateParameter[]) => void;
}

const ObjectTypes = [
  { name: "Викладач", url: "/api/teachers" },
  { name: "Спеціальність", url: "/api/specialties" },
  { name: "Тема дисципліни", url: "/api/courses/{{courseId}}/topics" }
];

export default function TemplateParametersEditor({
  parameters,
  onChange
}: TemplateParametersEditorProps) {
  const addParameter = () => {
    onChange([...parameters, { name: "", type: "text" }]);
  };

  const updateParameter = (index: number, param: Partial<TemplateParameter>) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], ...param } as TemplateParameter;
    onChange(updated);
  };

  const removeParameter = (index: number) => {
    onChange(parameters.filter((_, i) => i !== index));
  };

  const handleParamChange = (newType: TemplateParameter["type"], index: number, param: TemplateParameter) => {
    const updates: Partial<TemplateParameter> = { type: newType };
    
    // Clear subtype if not list
    updates.subtype = (newType === "list") ? (param.subtype ?? "text") : undefined;

    // For object type, always use optionsUrl and clear dictionary
    if (newType === "object") {
      updates.optionsUrl = param.optionsUrl ?? "";
      updates.dictionary = undefined;
    } else {
      // For non-object types, clear optionsUrl
      updates.optionsUrl = undefined;
    }

    updateParameter(index, updates);
  }

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label
          className="block text-amber-50 font-bold"
          title="Параметри шаблону, які користувач має ввести при генерації документа й можна використати в тексті шаблону"
        >
          Параметри шаблону:
        </label>
        <button
          onClick={addParameter}
          className="text-amber-50 hover:text-amber-200 cursor-pointer px-3 py-1 rounded-lg font-bold text-sm"
        >
          + Додати параметр
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {parameters.map((param, index) => (
          <div
            key={index}
            className="bg-zinc-800 border border-amber-50/30 rounded-lg p-3 flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2 flex justify-end">
                <button
                  onClick={() => removeParameter(index)}
                  className="self-end text-amber-50 hover:text-red-400 border-0 px-3 py-1 rounded-lg font-bold text-sm cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
              <div>
                <label className="block text-amber-50 font-bold mb-1 text-sm">
                  Назва параметра:
                </label>
                <input
                  className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
                  value={param.name}
                  onChange={(e) => updateParameter(index, { name: e.target.value })}
                  placeholder="Назва параметра"
                />
              </div>
              <div>
                <label className="block text-amber-50 font-bold mb-1 text-sm">Тип:</label>
                <select
                  className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
                  value={param.type}
                  onChange={(e) => handleParamChange(e.target.value as TemplateParameter["type"], index, param)}
                >
                  <option value="text">Текст</option>
                  <option value="number">Число</option>
                  <option value="boolean">Булеве значення</option>
                  <option value="list">Список</option>
                  <option value="object">Об'єкт</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-amber-50 font-bold mb-1 text-sm">Опис:</label>
                <input
                  className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
                  value={param.description || ""}
                  onChange={(e) =>
                    updateParameter(index, { description: e.target.value || undefined })
                  }
                  placeholder="Опис параметра (необов'язково)"
                />
              </div>
              {param.type === "list" && (
                <div>
                  <label className="block text-amber-50 font-bold mb-1 text-sm">
                    Тип елементів списку:
                  </label>
                  <select
                    className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
                    value={param.subtype || "text"}
                    onChange={(e) => {
                      const newSubtype = e.target.value as TemplateParameter["subtype"];
                      const updates: Partial<TemplateParameter> = {
                        subtype: newSubtype
                      };
                      // For object subtype, always use optionsUrl and clear dictionary
                      if (newSubtype === "object") {
                        updates.optionsUrl = param.optionsUrl ?? "";
                        updates.dictionary = undefined;
                      } else {
                        // For non-object subtypes, clear optionsUrl
                        updates.optionsUrl = undefined;
                      }
                      updateParameter(index, updates);
                    }}
                  >
                    <option value="text">Текст</option>
                    <option value="number">Число</option>
                    <option value="boolean">Булеве значення</option>
                    <option value="object">Об'єкт</option>
                  </select>
                </div>
              )}
              {(param.type === "object" || param.subtype === "object") && (
                <div className="col-span-2">
                  <label className="block text-amber-50 font-bold mb-1 text-sm">
                    API для завантаження опцій:
                  </label>
                  <select
                    className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200"
                    value={param.optionsUrl || ""}
                    onChange={(e) =>
                      updateParameter(index, { optionsUrl: e.target.value || undefined })
                    }
                  >
                    <option value="">-- Виберіть тип обʼєкта --</option>
                    {ObjectTypes.map((type) => (
                      <option key={type.name} value={type.url}>{type.name}</option>
                    ))}                    
                  </select>
                </div>
              )}
              {param.type !== "object" && param.subtype !== "object" && (
                <div className="col-span-2">
                  <label className="block text-amber-50 font-bold mb-1 text-sm">
                    Список опцій:
                  </label>
                  <textarea
                    className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 min-h-[80px]"
                    value={Array.isArray(param.dictionary) ? param.dictionary.join("\n") : ""}
                    onChange={(e) => {
                      const values = e.target.value.split("\n").filter((v) => v.trim() !== "");
                      updateParameter(index, {
                        dictionary: values.length > 0 ? values : undefined
                      });
                    }}
                    placeholder="Кожна опція на новому рядку (залиште порожнім, якщо опції не потрібні)"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {parameters.length === 0 && (
          <div className="text-amber-50/50 text-sm text-center py-4">
            Немає параметрів. Параметри дозволяють запитати в користувача дані, які будуть використані в тексті шаблону.
          </div>
        )}
      </div>
    </div>
  );
}

