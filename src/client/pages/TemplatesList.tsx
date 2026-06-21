import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faDownload, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { Template } from "@/stores/models";
import { loadAllTemplates, deleteTemplate } from "../templates";
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  ActionIcon,
  Tooltip,
  Box,
  Accordion,
  List,
  Anchor,
  Code,
} from "@mantine/core";

export default function TemplatesList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Template[]>([]);

  useEffect(() => {
    loadAllTemplates().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (template: Template) => {
    if (!confirm(`Ви впевнені, що хочете видалити шаблон "${template.name}"?`)) return;
    try {
      await deleteTemplate(template.id);
      setItems(items.filter((t) => t.id !== template.id));
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Не вдалося видалити шаблон");
    }
  };

  const handleDownload = async (template: Template) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/download`);
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = template.file;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Не вдалося завантажити шаблон");
    }
  };

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between">
        <Title order={2}>Шаблони</Title>
        <Tooltip label="Новий шаблон">
          <ActionIcon variant="default" onClick={() => navigate("/templates/new")}>
            <FontAwesomeIcon icon={faPlus} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {items.length === 0 ? (
          <Text c="dimmed">Немає шаблонів</Text>
        ) : (
          items.map((t) => (
            <Paper key={t.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    {t.file_exists === false && (
                      <Tooltip label="Файл шаблону не знайдено на диску">
                        <Text c="orange" component="span">
                          <FontAwesomeIcon icon={faTriangleExclamation} />
                        </Text>
                      </Tooltip>
                    )}
                    <Text fw={600} truncate>{t.name}</Text>
                  </Group>
                </Box>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label="Завантажити">
                    <ActionIcon variant="subtle" color="blue" onClick={() => handleDownload(t)}>
                      <FontAwesomeIcon icon={faDownload} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Редагувати">
                    <ActionIcon variant="subtle" onClick={() => navigate(`/templates/${t.id}`)}>
                      <FontAwesomeIcon icon={faPen} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Видалити">
                    <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(t)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

      <Accordion variant="contained">
        <Accordion.Item value="help">
          <Accordion.Control>Пам'ятка по шаблонам генерації</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Stack gap="xs">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Базовий синтаксис шаблонів документів (word)
                </Text>
                <List size="sm" spacing="xs">
                  <List.Item><Code>{"{{course.name}}"}</Code> — вставка одиночного значення.</List.Item>
                  <List.Item><Code>{"{{#topics}} … {{/topics}}"}</Code> — цикл по темах (всередині доступні поля теми, наприклад <Code>{"{{title}}"}</Code>).</List.Item>
                  <List.Item><Code>{"{{hours.fulltime.lectures}}"}</Code> — доступ до вкладених властивостей через крапку.</List.Item>
                  <List.Item><Code>{"{{course.name | uppercase}}"}</Code> — використання <Anchor href="https://github.com/sergkh/doc-gen/blob/main/src/docx/render.ts#L37" target="_blank">фільтрів</Anchor> для форматування.</List.Item>
                </List>
              </Stack>

              <Stack gap="xs">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Для текстових/xml документів використовується <Anchor href="https://handlebarsjs.com" target="_blank">Handlebars</Anchor>
                </Text>
                <List size="sm" spacing="xs">
                  <List.Item><Code>{"{{variable}}"}</Code> — вставка значення змінної.</List.Item>
                  <List.Item><Code>{"{{#each array}}…{{/each}}"}</Code> — цикл по масиву.</List.Item>
                  <List.Item><Code>{"{{#if condition}}…{{/if}}"}</Code> — умовний блок.</List.Item>
                  <List.Item><Code>{"{{#unless condition}}…{{/unless}}"}</Code> — блок, який виконується, якщо умова хибна.</List.Item>
                  <List.Item><Code>{"{{#with object}}…{{/with}}"}</Code> — контекст для вкладених властивостей об'єкта.</List.Item>
                </List>
              </Stack>

              <Stack gap="xs">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                  Об'єкт CourseGenerationData
                </Text>
                <Text size="sm">
                  Усередині Docxtemplator шаблону доступний кореневий об'єкт, що відповідає структурі{" "}
                  <Anchor href="https://github.com/sergkh/doc-gen/blob/main/src/stores/models.ts#L160" target="_blank">CourseGenerationData</Anchor>.
                  Основні поля:
                </Text>
                <List size="sm" spacing="xs">
                  <List.Item><Code>course</Code> — повна інформація про курс (назва, опис, викладачі).</List.Item>
                  <List.Item><Code>topics</Code> — масив тем з назвами, змістом та годинами.</List.Item>
                  <List.Item><Code>prerequisites</Code> / <Code>postrequisites</Code> — пов'язані дисципліни.</List.Item>
                  <List.Item><Code>generalResults</Code>, <Code>specialResults</Code>, <Code>programResults</Code> — навчальні результати різних типів.</List.Item>
                  <List.Item><Code>semesters</Code> та <Code>attestations</Code> — структура семестрів і атестацій з розбивкою годин.</List.Item>
                  <List.Item><Code>oneSemesterOnly</Code> — булевий прапорець для спрощення умов.</List.Item>
                  <List.Item><Code>hours</Code> — агреговані години (<Code>fulltime</Code> / <Code>inabscentia</Code>, лекції, практики, СРС).</List.Item>
                  <List.Item>будь-які додаткові параметри, які ви додаєте в інтерфейсі шаблону.</List.Item>
                </List>
              </Stack>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
