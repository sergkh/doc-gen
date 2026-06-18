import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { QuizQuestion } from "@/stores/models";
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
  Button,
} from "@mantine/core";

interface QuizEditorProps {
  quiz: QuizQuestion[];
  onQuizChange: (quiz: QuizQuestion[]) => void;
}

export default function QuizEditor({ quiz, onQuizChange }: QuizEditorProps) {
  const handleAddQuestion = () => {
    onQuizChange([...quiz, { question: "", options: ["", "", "", ""], answerIndex: 0 }]);
  };

  const handleUpdateOption = (qIndex: number, oIndex: number, value: string) => {
    onQuizChange(quiz.map((q, i) => i === qIndex ? { ...q, options: q.options.map((o, j) => j === oIndex ? value : o) } : q));
  };

  const handleSetCorrectAnswer = (qIndex: number, oIndex: number) => {
    onQuizChange(quiz.map((q, i) => i === qIndex ? { ...q, answerIndex: oIndex } : q));
  };

  return (
    <Stack>
      {quiz.map((question, qIndex) => (
        <Paper key={qIndex} withBorder p="sm">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600} size="sm">Питання {qIndex + 1}</Text>
              <ActionIcon variant="subtle" color="red" onClick={() => onQuizChange(quiz.filter((_, i) => i !== qIndex))}>
                <FontAwesomeIcon icon={faTrash} />
              </ActionIcon>
            </Group>
            <Textarea
              value={question.question}
              onChange={(e) => onQuizChange(quiz.map((q, i) => i === qIndex ? { ...q, question: e.currentTarget.value } : q))}
              placeholder="Текст питання"
              autosize
              minRows={2}
            />
            <Stack gap={4}>
              {question.options.map((option, oIndex) => (
                <Group key={oIndex} gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    color={question.answerIndex === oIndex ? "green" : "red"}
                    onClick={() => handleSetCorrectAnswer(qIndex, oIndex)}
                  >
                    <FontAwesomeIcon icon={question.answerIndex === oIndex ? faCheck : faXmark} />
                  </ActionIcon>
                  <TextInput
                    style={{ flex: 1 }}
                    size="sm"
                    value={option}
                    onChange={(e) => handleUpdateOption(qIndex, oIndex, e.currentTarget.value)}
                    placeholder={`Варіант ${oIndex + 1}`}
                  />
                </Group>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ))}
      <Button variant="default" leftSection={<FontAwesomeIcon icon={faPlus} />} onClick={handleAddQuestion}>
        Додати питання
      </Button>
    </Stack>
  );
}
