import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faTableCells, faListCheck, faSitemap, faChartPie } from "@fortawesome/free-solid-svg-icons";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import type { Course, Specialty } from "@/stores/models";
import { deleteCourse, formatDisciplineCode, uploadMultipleCourses, loadCoursesBySpecialty } from "../courses";
import { loadAllSpecialties } from "../specialties";
import {
  Title,
  Stack,
  Group,
  Select,
  TextInput,
  ActionIcon,
  Text,
  Paper,
  Box,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";

const LAST_SELECTED_SPECIALTY_KEY = "courses:lastSelectedSpecialtyId";

export default function CoursesList() {
  const navigate = useNavigate();
  const { specialtyId: urlSpecialtyId } = useParams<{ specialtyId: string }>();

  const [items, setItems] = useState<Course[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);

  useEffect(() => {
    loadAllSpecialties()
      .then((data) => {
        setSpecialties(data);
        if (!data[0]) return;

        const idFromUrl = urlSpecialtyId && data.some((s) => String(s.id) === urlSpecialtyId)
          ? urlSpecialtyId
          : null;

        if (idFromUrl) {
          setSelectedSpecialtyId(idFromUrl);
        } else {
          const savedSpecialtyId = localStorage.getItem(LAST_SELECTED_SPECIALTY_KEY);
          const hasSavedSpecialty = savedSpecialtyId
            ? data.some((specialty) => String(specialty.id) === savedSpecialtyId)
            : false;
          setSelectedSpecialtyId(hasSavedSpecialty ? savedSpecialtyId : String(data[0].id));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSpecialtyId) {
      localStorage.setItem(LAST_SELECTED_SPECIALTY_KEY, selectedSpecialtyId);
    }
  }, [selectedSpecialtyId]);

  useEffect(() => {
    if (selectedSpecialtyId) {
      loadCoursesBySpecialty(Number(selectedSpecialtyId))
        .then(setItems)
        .catch(console.error);
    }
  }, [selectedSpecialtyId]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const query = debouncedSearch.toLowerCase().trim();
    return items.filter((course) => {
      const name = course.name?.toLowerCase() || "";
      const okNo = course.data.ok_no?.toLowerCase() || "";
      const teacher = course.teacher?.toLowerCase() || "";
      return name.includes(query) || okNo.includes(query) || teacher.includes(query);
    });
  }, [items, debouncedSearch]);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    const uploadPromise = (async () => {
      const results = await uploadMultipleCourses(files);
      const successfulUploads = results.filter((r: any) => r.success).length;
      const failedUploads = results.filter((r: any) => !r.success).length;
      if (successfulUploads > 0)
        toast.success(`Успішно оброблено ${successfulUploads} файл${successfulUploads > 1 ? "и" : ""}`);
      if (failedUploads > 0)
        toast.error(`Не вдалося обробити ${failedUploads} файл${failedUploads > 1 ? "и" : ""}`);
      return results;
    })();

    toast.promise(uploadPromise, {
      loading: `Завантаження та обробка ${files.length} файл${files.length > 1 ? "ів" : "у"}...`,
      error: "Не вдалося обробити файли",
    });

    try {
      const results = await uploadPromise;
      if (results.length > 0 && selectedSpecialtyId) {
        const updatedCourses = await loadCoursesBySpecialty(Number(selectedSpecialtyId));
        setItems(updatedCourses);
      }
    } catch (error) {
      console.error("Error uploading syllabus:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const dirs = acceptedFiles.filter((f) => f.type === "application/x-directory");
      if (dirs.length > 0) {
        toast("Обробка папок ще не підтримується. Перетягніть файли .docx безпосередньо.");
        return;
      }
      handleFileUpload(acceptedFiles);
    },
    accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 100,
    disabled: isUploading,
    onDropRejected: () => toast.error("Будь ласка, перетягніть файли .docx"),
  });

  const handleDelete = async (course: Course) => {
    if (!confirm(`Ви впевнені, що хочете видалити дисципліну "${course.name}"?`)) return;
    try {
      await deleteCourse(course.id);
      setItems(items.filter((c) => c.id !== course.id));
      toast.success("Дисципліну успішно видалено");
    } catch (error) {
      console.error("Error deleting course:", error);
      toast.error("Не вдалося видалити дисципліну");
    }
  };

  const specialtyOptions = specialties.map((s) => ({
    value: String(s.id),
    label: `${s.code} ${s.name}`,
  }));

  return (
    <Stack maw={1200} mx="auto">
      <Group justify="space-between" align="flex-start">
        <Group align="center" gap="xs">
          <Title order={2}>Дисципліни</Title>
          <Tooltip label="Матриця результатів">
              <ActionIcon variant="subtle" onClick={() => navigate(`/specialties/${selectedSpecialtyId}/results/matrix`)}>
              <FontAwesomeIcon icon={faTableCells} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Дисципліни з результатами">
            <ActionIcon variant="subtle" onClick={() => navigate(`/specialties/${selectedSpecialtyId}/courses/results`)}>
              <FontAwesomeIcon icon={faListCheck} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="sm">
          <Select
            data={specialtyOptions}
            value={selectedSpecialtyId}
            onChange={(value) => {
              setSelectedSpecialtyId(value);
              if (value) navigate(`/specialties/${value}/courses`);
            }}
            w={280}
          />
          <TextInput
            placeholder="Пошук..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            w={160}
          />
          <Tooltip label="Нова дисципліна">
            <ActionIcon variant="default" onClick={() => navigate("/courses/new", { state: { specialtyId: selectedSpecialtyId } })}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Stack gap="xs">
        {filteredItems.length === 0 ? (
          <Text c="dimmed">
            {searchQuery ? "Немає дисциплін, що відповідають пошуку" : "Немає дисциплін"}
          </Text>
        ) : (
          filteredItems.map((d) => (
            <Paper key={d.id} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {formatDisciplineCode(d.data.ok_no)}. {d.name}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Викладач: {d.teacher ?? d.teacher_id}
                  </Text>
                </Box>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label="Редагувати">
                    <ActionIcon variant="subtle" onClick={() => navigate(`/courses/${d.id}`)}>
                      <FontAwesomeIcon icon={faPen} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Видалити">
                    <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(d)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

      <Paper withBorder p="md">
        <Text fw={500} mb="xs">Створити з Силабуса чи Робочої програми (.docx):</Text>
        <Box
          {...getRootProps()}
          p="xl"
          style={{
            border: `2px dashed var(--mantine-color-${isDragActive ? "blue-5" : "default-border"})`,
            borderRadius: "var(--mantine-radius-sm)",
            textAlign: "center",
            cursor: isUploading ? "not-allowed" : "pointer",
            opacity: isUploading ? 0.5 : 1,
            backgroundColor: isDragActive ? "var(--mantine-color-blue-light)" : undefined,
            transition: "all 150ms ease",
          }}
        >
          <input {...getInputProps()} />
          <Text c="dimmed">
            {isUploading
              ? "Завантаження..."
              : isDragActive
              ? "Відпустіть файли тут"
              : "Перетягніть файли .docx або натисніть для вибору"}
          </Text>
        </Box>
      </Paper>
    </Stack>
  );
}
