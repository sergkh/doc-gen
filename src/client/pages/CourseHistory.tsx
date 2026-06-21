import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import type { DocVersionRecord } from "@/stores/models";
import { loadCourseHistory } from "../courses";
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
          {records.map((r) => (
            <Paper key={r.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" mb={4}>
                    <Badge color={TYPE_COLORS[r.type] ?? "gray"}>{r.type}</Badge>
                    <Text size="sm" c="dimmed">
                      {new Date(r.stamp).toLocaleString("uk-UA")}
                    </Text>
                  </Group>
                  <Text size="sm">{r.comment}</Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
