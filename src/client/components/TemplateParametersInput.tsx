import { useState, useEffect } from "react";
import type { TemplateParameter } from "@/stores/models";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckDouble, faTrash } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import { formatPrompt } from "@/ai/prompt";

interface TemplateParametersInputProps {
  parameters: TemplateParameter[];
  values: Record<string, any>;
  disabled?: boolean;
  courseId?: string | number;
  onChange: (values: Record<string, any>) => void;
}

function ParamLabel({ param }: { param: TemplateParameter }) {
  return <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.description ?? param.name}
            <span className="text-xs font-normal opacity-70 ml-2">({param.name})</span>
          </label>;
}

export default function TemplateParametersInput({
  parameters,
  values,
  disabled = false,
  courseId,
  onChange
}: TemplateParametersInputProps) {
  const [optionsCache, setOptionsCache] = useState<
    Record<string, Array<{ id: string | number; name: string; [key: string]: any }>>
  >({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // Resolve URL template with courseId substitution
  const resolveUrl = (url: string): string => {
    return formatPrompt(url, { courseId: courseId ?? "" });
  };

  // Fetch options from URL when parameter with optionsUrl is selected
  useEffect(() => {
    const fetchOptions = async () => {
      for (const param of parameters) {
        if (!param.optionsUrl) continue;
        
        const resolvedUrl = resolveUrl(param.optionsUrl);
        const cacheKey = resolvedUrl; // Use resolved URL as cache key
        
        // Skip if URL requires courseId but it's not available
        if (param.optionsUrl.includes("{{courseId}}") && courseId === undefined) {
          continue;
        }
        
        if (!optionsCache[cacheKey] && !loadingOptions[cacheKey]) {
          setLoadingOptions((prev) => ({ ...prev, [cacheKey]: true }));
          try {
            const response = await fetch(resolvedUrl);
            if (response.ok) {
              const data = await response.json();
              // For object types, preserve full objects; for others, ensure id/name format
              const options = Array.isArray(data)
                ? data.map((item: any) => {
                    // If it's already an object with id/name, preserve it fully
                    if (
                      typeof item === "object" &&
                      item !== null &&
                      (item.id !== undefined || item.name !== undefined)
                    ) {
                      return item;
                    }
                    // Otherwise, create id/name format
                    return {
                      id: item.id ?? item.value ?? item,
                      name: item.name ?? item.label ?? String(item)
                    };
                  })
                : [];
              setOptionsCache((prev) => ({ ...prev, [cacheKey]: options }));
            } else {
              toast.error(`Помилка завантаження опцій для ${param.name}`);
            }
          } catch (error) {
            console.error(`Error fetching options for ${param.name}:`, error);
            toast.error(`Помилка завантаження опцій для ${param.name}`);
          } finally {
            setLoadingOptions((prev) => ({ ...prev, [cacheKey]: false }));
          }
        }
      }
    };

    if (parameters.length > 0) {
      fetchOptions();
    }
  }, [parameters, courseId]);

  const updateParameterValue = (paramName: string, value: any) => {
    onChange({ ...values, [paramName]: value });
  };

  const renderParameterInput = (param: TemplateParameter) => {
    const paramValue =
      values[param.name] ?? (param.type === "boolean" ? false : param.type === "list" ? [] : "");
    const resolvedUrl = param.optionsUrl ? resolveUrl(param.optionsUrl) : null;
    const options = resolvedUrl
      ? optionsCache[resolvedUrl] || []
      : param.dictionary
      ? Array.isArray(param.dictionary)
        ? param.dictionary.map((item, idx) => ({ id: idx, name: String(item) }))
        : [{ id: 0, name: String(param.dictionary) }]
      : [];

    if (param.type === "boolean") {
      return (
        <div key={param.name}>
          <ParamLabel param={param} />
          <select
            value={paramValue ? "true" : "false"}
            onChange={(e) => updateParameterValue(param.name, e.target.value === "true")}
            disabled={disabled}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="false">Ні</option>
            <option value="true">Так</option>
          </select>
        </div>
      );
    }

    if (param.type === "object") {
      return (
        <div key={param.name}>
          <ParamLabel param={param} />
          <select
            value={paramValue?.id ? String(paramValue.id) : ""}
            onChange={(e) => {
              if (e.target.value) {
                const option = options.find((opt) => String(opt.id) === e.target.value);
                updateParameterValue(param.name, option || undefined);
              } else {
                updateParameterValue(param.name, undefined);
              }
            }}
            disabled={disabled || loadingOptions[resolvedUrl || ""] || (param.optionsUrl?.includes("{{courseId}}") && courseId === undefined)}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="">-- Оберіть --</option>
            {options.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (param.type === "number") {
      if (options.length > 0) {
        return (
          <div key={param.name}>
            <ParamLabel param={param} />
            <select
              value={paramValue || ""}
              onChange={(e) =>
                updateParameterValue(param.name, e.target.value ? Number(e.target.value) : undefined)
              }
              disabled={disabled || loadingOptions[resolvedUrl || ""] || (param.optionsUrl?.includes("{{courseId}}") && courseId === undefined)}
              className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
            >
              <option value="">-- Оберіть --</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div key={param.name}>
          <ParamLabel param={param} />
          <input
            type="number"
            value={paramValue || ""}
            onChange={(e) =>
              updateParameterValue(param.name, e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={disabled}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50 placeholder:text-zinc-600"
            placeholder="Введіть число"
          />
        </div>
      );
    }

    if (param.type === "list") {
      const currentList = Array.isArray(paramValue) ? paramValue : [];
      const selectedIds =
        param.subtype === "object"
          ? currentList.map((item: any) => String(item?.id ?? item))
          : currentList.map(String);

      const handleAddItem = (value: string) => {
        if (!value) return;

        // For object subtype, store the full object
        if (param.subtype === "object") {
          const option = options.find((opt) => String(opt.id) === value);
          if (!option) return;

          // Check if already added
          if (selectedIds.includes(String(option.id))) return;

          updateParameterValue(param.name, [...currentList, option]);
        } else {
          const val = value;
          let convertedVal: any = val;
          if (param.subtype === "number") convertedVal = Number(val);
          else if (param.subtype === "boolean") convertedVal = val === "true";
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
          // Check if already added
          if (selectedIds.includes(String(val))) return;

          updateParameterValue(param.name, [...currentList, convertedVal]);
        }
      };

      const handleRemoveItem = (index: number) => {
        const newList = currentList.filter((_, i) => i !== index);
        updateParameterValue(param.name, newList.length > 0 ? newList : []);
      };

      const handleSelectAll = () => {
        if (options.length === 0) return;
        
        const availableOptions = options.filter((opt) => !selectedIds.includes(String(opt.id)));
        if (availableOptions.length === 0) return;

        if (param.subtype === "object") {
          // For object subtype, add all full objects
          updateParameterValue(param.name, [...currentList, ...availableOptions]);
        } else {
          // For other subtypes, convert values appropriately
          const newValues = availableOptions.map((opt) => {
            const val = String(opt.id);
            if (param.subtype === "number") return Number(val);
            if (param.subtype === "boolean") return val === "true";
            return val;
          });
          updateParameterValue(param.name, [...currentList, ...newValues]);
        }
      };

      const getItemDisplayName = (item: any) => {
        if (param.subtype === "object" && typeof item === "object" && item !== null) {
          return item.name ?? String(item.id ?? item);
        }
        const itemStr = String(item);
        const option = options.find((opt) => String(opt.id) === itemStr);
        return option ? option.name : itemStr;
      };

      const hasAvailableOptions = options.some((opt) => !selectedIds.includes(String(opt.id)));

      return (
        <div key={param.name} className="col-span-2">
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <div className="flex gap-2 mb-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleAddItem(e.target.value);
                  e.target.value = ""; // Reset dropdown
                }
              }}
              disabled={disabled || (resolvedUrl && loadingOptions[resolvedUrl]) || options.length === 0 || (param.optionsUrl?.includes("{{courseId}}") && courseId === undefined)}
              className="flex-1 bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
            >
              <option value="">-- Оберіть для додавання --</option>
              {options
                .filter((opt) => !selectedIds.includes(String(opt.id)))
                .map((opt) => (
                  <option key={opt.id} value={String(opt.id)}>
                    {opt.name}
                  </option>
                ))}
            </select>
            {options.length > 0 && hasAvailableOptions && (
              <button
                onClick={handleSelectAll}
                disabled={disabled || (resolvedUrl && loadingOptions[resolvedUrl]) || (param.optionsUrl?.includes("{{courseId}}") && courseId === undefined)}
                className="text-amber-50 hover:text-amber-200 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed px-3 py-1 rounded-lg font-bold text-sm whitespace-nowrap"
                type="button"
              >
                <FontAwesomeIcon icon={faCheckDouble} />
              </button>
            )}
          </div>
          {currentList.length > 0 ? (
            <div className="flex flex-col gap-2">
              {currentList.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-zinc-800 border border-amber-50/30 rounded px-2 py-1"
                >
                  <span className="text-amber-50 font-mono text-sm">{getItemDisplayName(item)}</span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-50/50 italic py-2">
              Список порожній. Оберіть елемент зі списку вище та натисніть "Додати"
            </div>
          )}
        </div>
      );
    }

    // text type
    if (options.length > 0) {
      return (
        <div key={param.name}>
          <label className="block text-amber-50 font-bold mb-1 text-sm">
            {param.name}
            {param.description && (
              <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
            )}
          </label>
          <select
            value={paramValue || ""}
            onChange={(e) => updateParameterValue(param.name, e.target.value || undefined)}
            disabled={disabled || loadingOptions[resolvedUrl || ""] || (param.optionsUrl?.includes("{{courseId}}") && courseId === undefined)}
            className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50"
          >
            <option value="">-- Оберіть --</option>
            {options.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={param.name}>
        <label className="block text-amber-50 font-bold mb-1 text-sm">
          {param.name}
          {param.description && (
            <span className="text-xs font-normal opacity-70 ml-2">({param.description})</span>
          )}
        </label>
        <input
          type="text"
          value={paramValue || ""}
          onChange={(e) => updateParameterValue(param.name, e.target.value || undefined)}
          disabled={disabled}
          className="w-full bg-transparent border border-amber-50/30 text-amber-50 font-mono text-sm py-1 px-2 rounded outline-none focus:border-amber-200 disabled:opacity-50 placeholder:text-zinc-600"
          placeholder="Введіть текст"
        />
      </div>
    );
  };

  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-amber-50/30 pt-3 mt-3">
      <label className="block text-amber-50 font-bold mb-3">Параметри шаблону:</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{parameters.map(renderParameterInput)}</div>
    </div>
  );
}

