import { useState, useEffect } from "react";
import type { TemplateParameter } from "@/stores/models";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckDouble, faTrash } from "@fortawesome/free-solid-svg-icons";
import toast from "react-hot-toast";
import { formatPrompt } from "@/ai/prompt";
import {
  Stack,
  Select,
  TextInput,
  NumberInput,
  Switch,
  Text,
  Group,
  ActionIcon,
  Badge,
  Divider,
  SimpleGrid,
} from "@mantine/core";

interface TemplateParametersInputProps {
  parameters: TemplateParameter[];
  values: Record<string, any>;
  disabled?: boolean;
  courseId?: string | number;
  onChange: (values: Record<string, any>) => void;
}

export default function TemplateParametersInput({
  parameters,
  values,
  disabled = false,
  courseId,
  onChange,
}: TemplateParametersInputProps) {
  const [optionsCache, setOptionsCache] = useState<
    Record<string, Array<{ id: string | number; name: string; [key: string]: any }>>
  >({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  const resolveUrl = (url: string): string =>
    formatPrompt(url, { courseId: courseId ?? "" });

  useEffect(() => {
    const fetchOptions = async () => {
      for (const param of parameters) {
        if (!param.optionsUrl) continue;
        const resolvedUrl = resolveUrl(param.optionsUrl);
        if (param.optionsUrl.includes("{{courseId}}") && courseId === undefined) continue;
        if (!optionsCache[resolvedUrl] && !loadingOptions[resolvedUrl]) {
          setLoadingOptions((prev) => ({ ...prev, [resolvedUrl]: true }));
          try {
            const response = await fetch(resolvedUrl);
            if (response.ok) {
              const data = await response.json();
              const options = Array.isArray(data)
                ? data.map((item: any) =>
                    typeof item === "object" && item !== null && (item.id !== undefined || item.name !== undefined)
                      ? item
                      : { id: item.id ?? item.value ?? item, name: item.name ?? item.label ?? String(item) }
                  )
                : [];
              setOptionsCache((prev) => ({ ...prev, [resolvedUrl]: options }));
            } else {
              toast.error(`Помилка завантаження опцій для ${param.name}`);
            }
          } catch (error) {
            console.error(`Error fetching options for ${param.name}:`, error);
            toast.error(`Помилка завантаження опцій для ${param.name}`);
          } finally {
            setLoadingOptions((prev) => ({ ...prev, [resolvedUrl]: false }));
          }
        }
      }
    };
    if (parameters.length > 0) fetchOptions();
  }, [parameters, courseId]);

  const updateParameterValue = (paramName: string, value: any) => {
    onChange({ ...values, [paramName]: value });
  };

  const getOptions = (param: TemplateParameter) => {
    const resolvedUrl = param.optionsUrl ? resolveUrl(param.optionsUrl) : null;
    const raw = resolvedUrl
      ? optionsCache[resolvedUrl] || []
      : param.dictionary
      ? Array.isArray(param.dictionary)
        ? param.dictionary.map((item, idx) => ({ id: idx, name: String(item) }))
        : [{ id: 0, name: String(param.dictionary) }]
      : [];
    return { options: raw, resolvedUrl };
  };

  const paramLabel = (param: TemplateParameter) =>
    `${param.description ?? param.name}${param.description ? ` (${param.name})` : ""}`;

  const renderParameterInput = (param: TemplateParameter) => {
    const paramValue =
      values[param.name] ?? (param.type === "boolean" ? false : param.type === "list" ? [] : "");
    const { options, resolvedUrl } = getOptions(param);
    const isOptionsLoading = !!(resolvedUrl && loadingOptions[resolvedUrl]);
    const isCourseIdMissing = !!(param.optionsUrl?.includes("{{courseId}}") && courseId === undefined);

    if (param.type === "boolean") {
      return (
        <Switch
          key={param.name}
          label={paramLabel(param)}
          checked={!!paramValue}
          onChange={(e) => updateParameterValue(param.name, e.currentTarget.checked)}
          disabled={disabled}
        />
      );
    }

    if (param.type === "object") {
      return (
        <Select
          key={param.name}
          label={paramLabel(param)}
          placeholder="-- Оберіть --"
          data={options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
          value={paramValue?.id ? String(paramValue.id) : null}
          onChange={(val) => {
            if (val) {
              const option = options.find((opt) => String(opt.id) === val);
              updateParameterValue(param.name, option ?? undefined);
            } else {
              updateParameterValue(param.name, undefined);
            }
          }}
          disabled={disabled || isOptionsLoading || isCourseIdMissing}
          clearable
          searchable
        />
      );
    }

    if (param.type === "number") {
      if (options.length > 0) {
        return (
          <Select
            key={param.name}
            label={paramLabel(param)}
            placeholder="-- Оберіть --"
            data={options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
            value={paramValue ? String(paramValue) : null}
            onChange={(val) => updateParameterValue(param.name, val ? Number(val) : undefined)}
            disabled={disabled || isOptionsLoading || isCourseIdMissing}
            clearable
            searchable
          />
        );
      }
      return (
        <NumberInput
          key={param.name}
          label={paramLabel(param)}
          placeholder="Введіть число"
          value={paramValue || ""}
          onChange={(val) => updateParameterValue(param.name, val || undefined)}
          disabled={disabled}
        />
      );
    }

    if (param.type === "list") {
      const currentList = Array.isArray(paramValue) ? paramValue : [];
      const selectedIds =
        param.subtype === "object"
          ? currentList.map((item: any) => String(item?.id ?? item))
          : currentList.map(String);

      const handleAddItem = (value: string | null) => {
        if (!value) return;
        if (param.subtype === "object") {
          const option = options.find((opt) => String(opt.id) === value);
          if (!option || selectedIds.includes(String(option.id))) return;
          updateParameterValue(param.name, [...currentList, option]);
        } else {
          let convertedVal: any = value;
          if (param.subtype === "number") convertedVal = Number(value);
          else if (param.subtype === "boolean") convertedVal = value === "true";
          if (selectedIds.includes(String(value))) return;
          updateParameterValue(param.name, [...currentList, convertedVal]);
        }
      };

      const handleRemoveItem = (index: number) => {
        const newList = currentList.filter((_, i) => i !== index);
        updateParameterValue(param.name, newList);
      };

      const handleSelectAll = () => {
        const available = options.filter((opt) => !selectedIds.includes(String(opt.id)));
        if (available.length === 0) return;
        if (param.subtype === "object") {
          updateParameterValue(param.name, [...currentList, ...available]);
        } else {
          const newValues = available.map((opt) => {
            const val = String(opt.id);
            if (param.subtype === "number") return Number(val);
            if (param.subtype === "boolean") return val === "true";
            return val;
          });
          updateParameterValue(param.name, [...currentList, ...newValues]);
        }
      };

      const getItemDisplayName = (item: any) => {
        if (param.subtype === "object" && typeof item === "object" && item !== null)
          return item.name ?? String(item.id ?? item);
        const itemStr = String(item);
        const option = options.find((opt) => String(opt.id) === itemStr);
        return option ? option.name : itemStr;
      };

      const availableOptions = options.filter((opt) => !selectedIds.includes(String(opt.id)));

      return (
        <Stack key={param.name} gap="xs">
          <Text fw={500} size="sm">
            {param.description ?? param.name}
            {param.description && (
              <Text span size="xs" c="dimmed" ml={4}>
                ({param.name})
              </Text>
            )}
          </Text>
          <Group gap="xs" align="flex-end">
            <Select
              style={{ flex: 1 }}
              placeholder="-- Оберіть для додавання --"
              data={availableOptions.map((opt) => ({ value: String(opt.id), label: opt.name }))}
              value={null}
              onChange={(val) => { handleAddItem(val); }}
              disabled={disabled || isOptionsLoading || options.length === 0 || isCourseIdMissing}
              searchable
            />
            {options.length > 0 && availableOptions.length > 0 && (
              <ActionIcon
                variant="default"
                onClick={handleSelectAll}
                disabled={disabled || isOptionsLoading || isCourseIdMissing}
                title="Додати всі"
              >
                <FontAwesomeIcon icon={faCheckDouble} />
              </ActionIcon>
            )}
          </Group>
          {currentList.length > 0 ? (
            <Stack gap={4}>
              {currentList.map((item, index) => (
                <Group key={index} justify="space-between" px="sm" py={4} style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-sm)" }}>
                  <Text size="sm">{getItemDisplayName(item)}</Text>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              Список порожній. Оберіть елемент зі списку вище.
            </Text>
          )}
        </Stack>
      );
    }

    // text type
    if (options.length > 0) {
      return (
        <Select
          key={param.name}
          label={paramLabel(param)}
          placeholder="-- Оберіть --"
          data={options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
          value={paramValue || null}
          onChange={(val) => updateParameterValue(param.name, val || undefined)}
          disabled={disabled || isOptionsLoading || isCourseIdMissing}
          clearable
          searchable
        />
      );
    }

    return (
      <TextInput
        key={param.name}
        label={paramLabel(param)}
        placeholder="Введіть текст"
        value={paramValue || ""}
        onChange={(e) => updateParameterValue(param.name, e.currentTarget.value || undefined)}
        disabled={disabled}
      />
    );
  };

  if (parameters.length === 0) return null;

  return (
    <Stack gap="md">
      <Divider label="Параметри шаблону" labelPosition="left" />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {parameters.map(renderParameterInput)}
      </SimpleGrid>
    </Stack>
  );
}
