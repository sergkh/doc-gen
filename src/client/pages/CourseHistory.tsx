import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChevronDown, faChevronRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { DocVersionRecord } from "@/stores/models";
import { loadCourseHistory, resetCourseHistory, revertCourseToHistory } from "../courses";
import {
  formatCourseChangeValue,
  formatCourseFieldPath,
  getCourseFieldChanges,
} from "./courseHistory.utils";
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  Button,
  Loader,
  Center,
  Box,
  Badge,
  Tooltip,
  Collapse,
  Divider,
  ScrollArea,
  Table,
  Alert,
} from "@mantine/core";

const TYPE_COLORS: Record<string, string> = {
  snapshot: "blue",
  patch: "yellow",
  tombstone: "red",
};

export default function CourseHistory() {
  const { courseId: id } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [records, setRecords] = useState<DocVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);
  const [resettingHistory, setResettingHistory] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());
  const hasReconstructionError = records.some((record) => Boolean(record.reconstruction_error));

  useEffect(() => {
    if (!id) return;
    loadCourseHistory(Number(id))
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Stack maw={1100} mx="auto">
      <Group>
        <Button variant="subtle" onClick={() => navigate(`/courses/${id}`)} px={0}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <Title order={2}>Історія змін курсу</Title>
      </Group>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : records.length === 0 ? (
        <Text c="dimmed">Немає записів історії</Text>
      ) : (
        <Stack gap="xs">
          {hasReconstructionError && (
            <Alert
              color="yellow"
              title="Частина старої історії несумісна з поточною структурою курсу"
              icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            >
              <Stack gap="xs" align="flex-start">
                <Text size="sm">
                  Зміни можна переглядати, але деякі старі версії неможливо повністю відтворити.
                  Скидання видалить усі старі записи історії та створить новий snapshot поточного стану.
                </Text>
                <Button
                  size="compact-sm"
                  color="red"
                  variant="outline"
                  loading={resettingHistory}
                  onClick={async () => {
                    if (!id || !confirm("Видалити всю стару історію курсу та створити новий snapshot поточного стану?")) return;
                    setResettingHistory(true);
                    try {
                      await resetCourseHistory(Number(id));
                      setRecords(await loadCourseHistory(Number(id)));
                      setExpandedRecords(new Set());
                    } catch (error) {
                      console.error(error);
                      alert(error instanceof Error ? error.message : "Помилка скидання історії");
                    } finally {
                      setResettingHistory(false);
                    }
                  }}
                >
                  Скинути історію
                </Button>
              </Stack>
            </Alert>
          )}
          {records.map((r, index) => {
            const isCurrent = index === 0;
            const changes = getCourseFieldChanges(r.changes ?? (r.type === "patch" ? r.data : undefined));
            const isExpanded = expandedRecords.has(r.id);
            return (
            <Paper key={r.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" mb={4}>
                    <Badge color={TYPE_COLORS[r.type] ?? "gray"}>{r.type}</Badge>
                    <Text size="sm" c="dimmed">
                      {new Date(r.stamp).toLocaleString("uk-UA")}
                    </Text>
                  </Group>
                  <Text size="sm">{r.comment}</Text>
                  {changes.length > 0 && (
                    <Text size="xs" c="dimmed">
                      Змінено полів: {changes.length}
                    </Text>
                  )}
                </Box>
                <Group gap="xs" wrap="nowrap">
                  {changes.length > 0 && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      leftSection={<FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />}
                      onClick={() => setExpandedRecords((current) => {
                        const next = new Set(current);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })}
                    >
                      Деталі
                    </Button>
                  )}
                  <Tooltip label={isCurrent ? "Поточний стан" : "Відновити курс до цього стану"}>
                    <Button
                      size="compact-xs"
                      variant="outline"
                      color="red"
                      loading={reverting === r.id}
                      disabled={isCurrent}
                      onClick={async () => {
                        if (!confirm("Відновити курс до цього стану?")) return;
                        setReverting(r.id);
                        try {
                          await revertCourseToHistory(Number(id), r.id);
                          const updated = await loadCourseHistory(Number(id));
                          setRecords(updated);
                        } catch (e) {
                          console.error(e);
                          alert(e instanceof Error ? e.message : "Помилка відновлення");
                        } finally {
                          setReverting(null);
                        }
                      }}
                    >
                      Відновити
                    </Button>
                  </Tooltip>
                </Group>
              </Group>
              <Collapse expanded={isExpanded}>
                <Divider my="sm" />
                <ScrollArea>
                  <Table withTableBorder withColumnBorders verticalSpacing="xs" miw={720}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="32%">Поле</Table.Th>
                        <Table.Th w="34%">Було</Table.Th>
                        <Table.Th w="34%">Стало</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {changes.map((change, changeIndex) => (
                        <Table.Tr key={`${change.path}-${change.kind}-${changeIndex}`}>
                          <Table.Td fw={500}>{formatCourseFieldPath(change.path)}</Table.Td>
                          <Table.Td
                            c={change.kind === "added" ? "dimmed" : "red.7"}
                            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                          >
                            {change.kind === "moved"
                              ? `Позиція ${formatCourseChangeValue(change.before)}`
                              : formatCourseChangeValue(change.before)}
                          </Table.Td>
                          <Table.Td
                            c={change.kind === "removed" ? "dimmed" : "green.7"}
                            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                          >
                            {change.kind === "moved"
                              ? `Позиція ${formatCourseChangeValue(change.after)}`
                              : formatCourseChangeValue(change.after)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Collapse>
            </Paper>
          );
        })}
        </Stack>
      )}
    </Stack>
  );
}
