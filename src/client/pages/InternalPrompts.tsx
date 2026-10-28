import { useCallback, useEffect, useState } from "react";
import { Accordion, Button, Group, Paper, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import toast from "react-hot-toast";

type InternalPrompt = {
  key: string;
  title: string;
  text: string;
  model: string | null;
  modelConfigurable: boolean;
};

const models = ["gpt-5.4", "gpt-5.4-mini", "gpt-5-mini", "gpt-5"];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
    ? data.error
    : fallback;
}

function isPromptList(data: unknown): data is InternalPrompt[] {
  return Array.isArray(data) && data.every((item) =>
    typeof item === "object" && item !== null
    && typeof item.key === "string"
    && typeof item.title === "string"
    && typeof item.text === "string"
    && (typeof item.model === "string" || item.model === null)
    && typeof item.modelConfigurable === "boolean"
  );
}

const promptGroups = [
  {
    value: "generation",
    title: "Генерація навчальних матеріалів",
    description: "Промпти для тем, підтеми, занять, результатів навчання та аналізу документів.",
    includes: (prompt: InternalPrompt) => prompt.key.startsWith("ai.") && prompt.key !== "ai.template_prompt_preset",
  },
  {
    value: "template",
    title: "Шаблони документів",
    description: "Початкові налаштування для нових AI-полів у шаблонах документів.",
    includes: (prompt: InternalPrompt) => prompt.key === "ai.template_prompt_preset",
  },
  {
    value: "mcp",
    title: "MCP",
    description: "Загальні інструкції та описи інструментів для MCP-клієнтів.",
    includes: (prompt: InternalPrompt) => prompt.key.startsWith("mcp."),
  },
];

export default function InternalPrompts() {
  const [items, setItems] = useState<InternalPrompt[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/internal-prompts");
      if (!response.ok) throw new Error(await responseError(response, "Не вдалося завантажити внутрішні промпти"));

      const data: unknown = await response.json();
      if (!isPromptList(data)) throw new Error("Сервер повернув некоректний список внутрішніх промптів");
      setItems(data);
    } catch (error) {
      const message = errorMessage(error, "Не вдалося завантажити внутрішні промпти");
      setLoadError(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = (key: string, change: Partial<InternalPrompt>) =>
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...change } : item));

  const save = async (prompt: InternalPrompt) => {
    setSaving(prompt.key);
    try {
      const response = await fetch(`/api/internal-prompts/${encodeURIComponent(prompt.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt.text, model: prompt.model }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Не вдалося зберегти промпт"));
      toast.success("Промпт збережено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти промпт");
    } finally {
      setSaving(null);
    }
  };

  return <Stack maw={1100} mx="auto">
    <Stack gap={2}>
      <Title order={2}>Внутрішні промпти</Title>
      <Text c="dimmed">Тут можна редагувати промпти для ШІ-генерації та MCP сервера</Text>
    </Stack>
    {loadError && <Paper withBorder p="sm"><Group justify="space-between"><Text c="red" size="sm">{loadError}</Text><Button size="xs" variant="default" onClick={() => void load()}>Спробувати знову</Button></Group></Paper>}
    <Accordion multiple defaultValue={["generation", "template", "mcp"]} variant="contained">
      {promptGroups.map((group) => {
        const prompts = items.filter(group.includes);
        if (prompts.length === 0) return null;
        return <Accordion.Item key={group.value} value={group.value}>
          <Accordion.Control>
            <Text fw={600}>{group.title}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">{group.description}</Text>
              {prompts.map((prompt) => <PromptCard key={prompt.key} prompt={prompt} saving={saving === prompt.key} onChange={update} onSave={save} />)}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>;
      })}
    </Accordion>
  </Stack>;
}

type PromptCardProps = {
  prompt: InternalPrompt;
  saving: boolean;
  onChange: (key: string, change: Partial<InternalPrompt>) => void;
  onSave: (prompt: InternalPrompt) => Promise<void>;
};

function PromptCard({ prompt, saving, onChange, onSave }: PromptCardProps) {
  // MCP contains many cards. Mantine's autosizing textarea uses ResizeObserver,
  // which Firefox reports as an error with a null error object when this panel
  // expands and all of its observers run in the same layout pass.
  const autosize = !prompt.key.startsWith("mcp.");

  return <Paper withBorder p="md">
      <Stack gap="sm">
        <div><Text fw={600}>{prompt.title}</Text><Text size="xs" c="dimmed">{prompt.key}</Text></div>
        <Textarea label="Текст" autosize={autosize} minRows={4} value={prompt.text} onChange={(event) => onChange(prompt.key, { text: event.currentTarget.value })} />
        <Group justify="space-between" align="end">
          {prompt.modelConfigurable ? <Select label="Модель" clearable data={models} value={prompt.model} onChange={(model) => onChange(prompt.key, { model })} /> : <Text size="sm" c="dimmed">Модель обирає MCP-клієнт.</Text>}
          <Button onClick={() => onSave(prompt)} loading={saving}>Зберегти</Button>
        </Group>
      </Stack>
    </Paper>;
}
