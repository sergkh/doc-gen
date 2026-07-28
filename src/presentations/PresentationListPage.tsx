import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChalkboard, faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import toast from "react-hot-toast";
import type { PresentationTopicSummary } from "./models";
import { createTopicPresentation, loadCoursePresentations } from "./client";

export default function PresentationListPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const id = Number(courseId);
  const [courseName, setCourseName] = useState("");
  const [topics, setTopics] = useState<PresentationTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const mobile = useMediaQuery("(max-width: 47.99em)");

  useEffect(() => {
    loadCoursePresentations(id)
      .then((payload) => {
        setCourseName(payload.course.name);
        setTopics(payload.topics);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Center h={300}><Loader /></Center>;

  return (
    <Stack maw={1000} mx="auto">
      <Group>
        <Button component={Link} to={`/courses/${id}`} variant="subtle" px={0}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <div>
          <Title order={2}>Презентації</Title>
          <Text c="dimmed">{courseName}</Text>
        </div>
      </Group>

      {topics.length === 0 ? (
        <Paper withBorder p="xl">
          <Text c="dimmed" ta="center">Спочатку додайте теми до дисципліни.</Text>
        </Paper>
      ) : (
        <Stack gap="sm">
          {topics.map((topic) => (
            <Paper key={topic.uid} withBorder p="md">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={700}>{topic.index}. {topic.name}</Text>
                    <Badge color={topic.exists ? "green" : "gray"} variant="light">
                      {topic.exists ? `${topic.slideCount} слайдів` : "Не створено"}
                    </Badge>
                  </Group>
                  {topic.revision && (
                    <Text size="xs" c="dimmed">Версія {topic.revision.slice(0, 12)}</Text>
                  )}
                </div>
                {topic.exists ? (
                  <Button
                    aria-label="Відкрити презентацію"
                    leftSection={mobile ? undefined : <FontAwesomeIcon icon={faChalkboard} />}
                    px={mobile ? "sm" : undefined}
                    onClick={() => navigate(`/courses/${id}/presentations/${topic.uid}`)}
                  >
                    {mobile ? <FontAwesomeIcon icon={faChalkboard} /> : "Відкрити"}
                  </Button>
                ) : (
                  <Button
                    aria-label="Створити презентацію"
                    variant="default"
                    leftSection={mobile ? undefined : <FontAwesomeIcon icon={faPlus} />}
                    px={mobile ? "sm" : undefined}
                    loading={creating === topic.uid}
                    onClick={async () => {
                      setCreating(topic.uid);
                      try {
                        await createTopicPresentation(id, topic.uid);
                        navigate(`/courses/${id}/presentations/${topic.uid}`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Не вдалося створити презентацію.");
                      } finally {
                        setCreating(null);
                      }
                    }}
                  >
                    {mobile ? <FontAwesomeIcon icon={faPlus} /> : "Створити"}
                  </Button>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
