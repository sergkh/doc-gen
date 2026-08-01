import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { DocVersionRecord } from "@/stores/models";
import { loadSpecialtyHistory, revertSpecialtyToHistory } from "../specialties";
import {
  formatHistoryChangeValue,
  formatSpecialtyFieldPath,
  getHistoryFieldChanges,
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
} from "@mantine/core";

const TYPE_COLORS: Record<string, string> = {
  snapshot: "blue",
  patch: "yellow",
  tombstone: "red",
};

export default function SpecialtyHistory() {
  const { specialtyId: id } = useParams<{ specialtyId: string }>();
  const navigate = useNavigate();
  const [records, setRecords] = useState<DocVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    loadSpecialtyHistory(Number(id))
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Stack maw={1100} mx="auto">
      <Group>
        <Button variant="subtle" onClick={() => navigate(`/specialties/${id}`)} px={0}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <Title order={2}>Історія змін спеціальності</Title>
      </Group>

      {loading ? (
        <Center h={200}><Loader /></Center>
      ) : records.length === 0 ? (
        <Text c="dimmed">Немає записів історії</Text>
      ) : (
        <Stack gap="xs">
          {records.map((r, index) => {
            const isCurrent = index === 0;
            const changes = getHistoryFieldChanges(r.changes ?? (r.type === "patch" ? r.data : undefined));
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
                    <Tooltip label={isCurrent ? "Поточний стан" : "Відновити спеціальність до цього стану"}>
                      <Button
                        size="compact-xs"
                        variant="outline"
                        color="red"
                        loading={reverting === r.id}
                        disabled={isCurrent}
                        onClick={async () => {
                          if (!id || !confirm("Відновити спеціальність до цього стану?")) return;
                          setReverting(r.id);
                          try {
                            await revertSpecialtyToHistory(Number(id), r.id);
                            const updated = await loadSpecialtyHistory(Number(id));
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
                <Collapse in={isExpanded}>
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
                            <Table.Td fw={500}>{formatSpecialtyFieldPath(change.path)}</Table.Td>
                            <Table.Td
                              c={change.kind === "added" ? "dimmed" : "red.7"}
                              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                            >
                              {change.kind === "moved"
                                ? `Позиція ${formatHistoryChangeValue(change.before)}`
                                : formatHistoryChangeValue(change.before)}
                            </Table.Td>
                            <Table.Td
                              c={change.kind === "removed" ? "dimmed" : "green.7"}
                              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                            >
                              {change.kind === "moved"
                                ? `Позиція ${formatHistoryChangeValue(change.after)}`
                                : formatHistoryChangeValue(change.after)}
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
