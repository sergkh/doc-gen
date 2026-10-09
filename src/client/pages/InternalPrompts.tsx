import { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch("/api/internal-prompts")
      .then(async (response) => {
        if (!response.ok) throw new Error("Не вдалося завантажити внутрішні промпти");
        return response.json() as Promise<InternalPrompt[]>;
      })
      .then(setItems)
      .catch((error) => toast.error(error.message));
  }, []);

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
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Не вдалося зберегти промпт");
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
      <Text c="dimmed">Тут редагується лише текст і, для внутрішньої AI-генерації, модель. Схеми відповідей і контракти MCP залишаються в коді.</Text>
    </Stack>
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
  return <Paper withBorder p="md">
      <Stack gap="sm">
        <div><Text fw={600}>{prompt.title}</Text><Text size="xs" c="dimmed">{prompt.key}</Text></div>
        <Textarea label="Текст" autosize minRows={4} value={prompt.text} onChange={(event) => onChange(prompt.key, { text: event.currentTarget.value })} />
        <Group justify="space-between" align="end">
          {prompt.modelConfigurable ? <Select label="Модель" clearable data={models} value={prompt.model} onChange={(model) => onChange(prompt.key, { model })} /> : <Text size="sm" c="dimmed">Модель обирає MCP-клієнт.</Text>}
          <Button onClick={() => onSave(prompt)} loading={saving}>Зберегти</Button>
        </Group>
      </Stack>
    </Paper>;
}
