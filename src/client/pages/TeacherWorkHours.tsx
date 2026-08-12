import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Teacher } from "@/stores/models";
import { loadTeacher, upsertTeacher } from "../teachers";
import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  NumberInput,
  Paper,
  Modal,
  Select,
  Slider,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
import "./TeacherWorkHours.css";

type DirectoryItem = {
  id: number | string;
  name: string;
};

type LessonType = "lection" | "practice" | "exam" | "lection_in_absentia" | "practice_in_absentia";

type ScheduleItem = {
  name: string;
  place: string;
  group: string;
  teacher: string;
  type: LessonType;
  start: string;
  end: string;
  updated?: string;
};

type DailyWorkload = {
  day: number;
  slots: number[];
  total: number;
  explanation: string;
  isWeekend: boolean;
  isDayOff: boolean;
};

type WorkHours = {
  science: number;
  methodical: number;
  organizational: number;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const STRUCTURE_ID = "0";
const MAX_WEEKDAY_HOURS = 7.2;
const MAX_LESSONS_PER_WEEKDAY = Math.floor(MAX_WEEKDAY_HOURS / 2);
const MAX_WEEKDAY_MINUTES = Math.round(MAX_WEEKDAY_HOURS * 60);
const WORK_SHIFT_MINUTES = 60;

const lessonTypeLabels: Record<LessonType, string> = {
  lection: "Лекція",
  practice: "Практика",
  exam: "Екзамен",
  lection_in_absentia: "Лекція (заочно)",
  practice_in_absentia: "Практика (заочно)",
};

const workTypeLabels: Record<keyof WorkHours, string> = {
  science: "Наука",
  methodical: "Методика",
  organizational: "Організаційна робота",
};

const apiGet = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    month: toMonthInput(start),
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
};

const getMonthRange = (monthInput: string) => {
  const [year = 0, month = 1] = monthInput.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
};

const parseApiDate = (value: string) => new Date(value.replace(" ", "T"));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseApiDate(value));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseApiDate(value));

const minutesBetween = (start: string, end: string) => {
  const diff = parseApiDate(end).getTime() - parseApiDate(start).getTime();
  return Math.max(0, Math.round(diff / 60000));
};

const academicHours = (_start: string, _end: string) => 2;

const workloadSlot = (start: string) => {
  const date = parseApiDate(start);
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (minutes < 570) return 0; // 08:00
  if (minutes < 690) return 1; // 09:30
  if (minutes < 790) return 2; // 11:30
  if (minutes < 880) return 3; // 13:10
  if (minutes < 970) return 4; // 14:40
  return 5; // 16:10 or later
};

const isWeekend = (year: number, monthIndex: number, day: number) => {
  const dayOfWeek = new Date(year, monthIndex, day).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const isDayOff = (year: number, monthIndex: number, day: number, additionalDaysOff: Set<number>) =>
  isWeekend(year, monthIndex, day) || additionalDaysOff.has(day);

const formatDuration = (minutes: number) => {
  const normalized = Math.max(0, Math.round(minutes));
  return `${Math.floor(normalized / 60)}:${String(normalized % 60).padStart(2, "0")}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const allocateWorkloadSlots = (items: ScheduleItem[]) => {
  const slots = [0, 0, 0, 0, 0];
  const lateLessons: ScheduleItem[] = [];

  for (const item of items) {
    const slot = workloadSlot(item.start);
    if (slot === 5) {
      lateLessons.push(item);
    } else {
      const freeSlot = slots[slot] === 0 ? slot : slots.findIndex(hours => hours === 0);
      const targetSlot = freeSlot === -1 ? slot : freeSlot;
      slots[targetSlot] = (slots[targetSlot] ?? 0) + academicHours(item.start, item.end);
    }
  }

  for (const item of lateLessons) {
    const freeSlot = slots.findLastIndex(hours => hours === 0);
    const targetSlot = freeSlot === -1 ? slots.length - 1 : freeSlot;
    slots[targetSlot] = (slots[targetSlot] ?? 0) + academicHours(item.start, item.end);
  }

  return {
    slots: slots.map(hours => Number(hours.toFixed(2))),
    explanation: items
      .map(item => `${formatTime(item.start)}-${formatTime(item.end)} ${item.name}; ${lessonTypeLabels[item.type] ?? item.type}; ${item.group}`)
      .join("\n"),
  };
};

const monthFormatter = new Intl.DateTimeFormat("uk-UA", { month: "long" });

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: monthFormatter.format(new Date(2026, index, 1)) };
});

const getMonthLabel = (dateInput: string) => {
  const date = new Date(`${dateInput}T00:00:00`);
  return monthFormatter.format(date);
};

export function App() {
  const { id } = useParams();
  const navigate = useNavigate();
  const defaultRange = useMemo(getCurrentMonthRange, []);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [chairs, setChairs] = useState<DirectoryItem[]>([]);
  const [mkrTeachers, setMkrTeachers] = useState<DirectoryItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [selectedChairId, setSelectedChairId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [reportMonth, setReportMonth] = useState(defaultRange.month);
  const [additionalDaysOff, setAdditionalDaysOff] = useState<Set<number>>(() => new Set());
  const [sciencePercentage, setSciencePercentage] = useState(50);
  const [workByDay, setWorkByDay] = useState<Record<number, WorkHours>>({});
  const [directoryState, setDirectoryState] = useState<LoadState>("idle");
  const [isSavingMkr, setIsSavingMkr] = useState(false);
  const [reportState, setReportState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const { startDate, endDate } = useMemo(() => getMonthRange(reportMonth), [reportMonth]);

  const selectedMonth = reportMonth.slice(5, 7);
  const selectedYear = reportMonth.slice(0, 4);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, index) => {
    const year = String(currentYear - 5 + index);
    return { value: year, label: year };
  });

  const updateReportMonth = (year: string, month: string) => setReportMonth(`${year}-${month}`);

  const needsMkrSelection = Boolean(teacher && (!teacher.mkr_department_id || !teacher.mkr_teacher_id));

  const saveMkrSelection = async () => {
    if (!teacher || !selectedChairId || !selectedTeacherId) return;

    const updatedTeacher = {
      ...teacher,
      mkr_department_id: Number(selectedChairId),
      mkr_teacher_id: Number(selectedTeacherId),
    };

    setIsSavingMkr(true);
    try {
      await upsertTeacher(updatedTeacher);
      setTeacher(updatedTeacher);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося зберегти зв’язок з МКР");
    } finally {
      setIsSavingMkr(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadTeacher(id)
      .then((loadedTeacher) => {
        setTeacher(loadedTeacher);
        setSelectedChairId(loadedTeacher.mkr_department_id ? String(loadedTeacher.mkr_department_id) : "");
        setSelectedTeacherId(loadedTeacher.mkr_teacher_id ? String(loadedTeacher.mkr_teacher_id) : "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [id]);

  useEffect(() => {
    if (!teacher || (teacher.mkr_department_id && teacher.mkr_teacher_id)) return;
    setChairs([]);

    let isActive = true;
    setDirectoryState("loading");
    setError("");

    apiGet<DirectoryItem[]>(`/api/work-hours/structures/${STRUCTURE_ID}/chairs`)
      .then(items => {
        if (!isActive) return;
        setChairs(items);
        setDirectoryState("ready");
      })
      .catch((caught: Error) => {
        if (!isActive) return;
        setError(caught.message);
        setDirectoryState("error");
      });

    return () => {
      isActive = false;
    };
  }, [teacher?.mkr_department_id, teacher?.mkr_teacher_id]);

  useEffect(() => {
    if (!needsMkrSelection || !selectedChairId) return;

    let isActive = true;
    setDirectoryState("loading");
    setError("");

    apiGet<DirectoryItem[]>(`/api/work-hours/structures/${STRUCTURE_ID}/chairs/${selectedChairId}/teachers`)
      .then(items => {
        if (!isActive) return;
        setMkrTeachers(items);
        setDirectoryState("ready");
      })
      .catch((caught: Error) => {
        if (!isActive) return;
        setError(caught.message);
        setDirectoryState("error");
      });

    return () => {
      isActive = false;
    };
  }, [needsMkrSelection, selectedChairId]);

  useEffect(() => {
    setAdditionalDaysOff(new Set());
  }, [reportMonth]);

  const sortedSchedule = useMemo(
    () =>
      [...schedule].sort((first, second) => parseApiDate(first.start).getTime() - parseApiDate(second.start).getTime()),
    [schedule],
  );

  const adjustedLessonsByDay = useMemo(() => {
    const [year = 0, month = 1] = reportMonth.split("-").map(Number);
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const lessonsByDay = new Map<number, ScheduleItem[]>();

    for (let day = 1; day <= daysInMonth; day += 1) {
      lessonsByDay.set(day, []);
    }

    for (const item of sortedSchedule) {
      const day = parseApiDate(item.start).getDate();
      lessonsByDay.get(day)?.push(item);
    }

    const nextAvailableWeekday = (afterDay: number) => {
      for (let day = afterDay + 1; day <= daysInMonth; day += 1) {
        if (!isDayOff(year, monthIndex, day, additionalDaysOff) && (lessonsByDay.get(day)?.length ?? 0) < MAX_LESSONS_PER_WEEKDAY) {
          return day;
        }
      }
      return undefined;
    };

    const previousAvailableWeekday = (beforeDay: number) => {
      for (let day = beforeDay - 1; day >= 1; day -= 1) {
        if (!isDayOff(year, monthIndex, day, additionalDaysOff) && (lessonsByDay.get(day)?.length ?? 0) < MAX_LESSONS_PER_WEEKDAY) {
          return day;
        }
      }
      return undefined;
    };

    for (let day = 1; day <= daysInMonth; day += 1) {
      const lessons = lessonsByDay.get(day) ?? [];
      lessons.sort((first, second) => parseApiDate(first.start).getTime() - parseApiDate(second.start).getTime());

      if (isDayOff(year, monthIndex, day, additionalDaysOff)) {
        lessonsByDay.set(day, []);
        for (const lesson of lessons) {
          const targetDay = nextAvailableWeekday(day) ?? previousAvailableWeekday(day);
          if (targetDay) {
            lessonsByDay.get(targetDay)?.push(lesson);
          } else {
            lessonsByDay.get(day)?.push(lesson);
          }
        }
        continue;
      }

      while (lessons.length > MAX_LESSONS_PER_WEEKDAY) {
        const lesson = lessons.pop();
        const targetDay = nextAvailableWeekday(day) ?? previousAvailableWeekday(day);
        if (!lesson || !targetDay) {
          if (lesson) lessons.push(lesson);
          break;
        }
        lessonsByDay.get(targetDay)?.push(lesson);
      }
    }

    return lessonsByDay;
  }, [additionalDaysOff, reportMonth, sortedSchedule]);

  const monthlyWorkload = useMemo(() => {
    const [year = 0, month = 1] = reportMonth.split("-").map(Number);
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index): DailyWorkload => {
      const day = index + 1;
      const weekend = isWeekend(year, monthIndex, day);
      const dayOff = isDayOff(year, monthIndex, day, additionalDaysOff);
      const allocation = allocateWorkloadSlots(adjustedLessonsByDay.get(day) ?? []);

      return {
        day,
        slots: allocation.slots,
        total: Number(allocation.slots.reduce((sum, hours) => sum + hours, 0).toFixed(2)),
        explanation: allocation.explanation,
        isWeekend: weekend,
        isDayOff: dayOff,
      };
    });
  }, [additionalDaysOff, adjustedLessonsByDay, reportMonth]);

  const resolvedWorkByDay = useMemo(() => {
    const work = new Map<number, WorkHours>();

    for (const item of monthlyWorkload) {
      if (item.isDayOff) {
        work.set(item.day, { science: 0, methodical: 0, organizational: 0 });
        continue;
      }

      const availableMinutes = Math.max(0, MAX_WEEKDAY_MINUTES - Math.round(item.total * 60));
      const organizational = clamp(workByDay[item.day]?.organizational ?? 0, 0, availableMinutes);
      const remainingMinutes = availableMinutes - organizational;
      const science = workByDay[item.day]?.science ?? Math.round((remainingMinutes * sciencePercentage) / 100);
      const methodical = workByDay[item.day]?.methodical ?? remainingMinutes - science;

      work.set(item.day, {
        science: clamp(science, 0, remainingMinutes),
        methodical: clamp(methodical, 0, remainingMinutes),
        organizational,
      });
    }

    return work;
  }, [monthlyWorkload, sciencePercentage, workByDay]);

  useEffect(() => {
    setWorkByDay(current => {
      const next: Record<number, WorkHours> = {};

      for (const item of monthlyWorkload) {
        if (item.isDayOff) {
          next[item.day] = { science: 0, methodical: 0, organizational: 0 };
          continue;
        }

        const availableMinutes = Math.max(0, MAX_WEEKDAY_MINUTES - Math.round(item.total * 60));
        const organizational = clamp(current[item.day]?.organizational ?? 0, 0, availableMinutes);
        const remainingMinutes = availableMinutes - organizational;
        const science = Math.round((remainingMinutes * sciencePercentage) / 100);

        next[item.day] = {
          science,
          methodical: remainingMinutes - science,
          organizational,
        };
      }

      return next;
    });
  }, [monthlyWorkload, sciencePercentage]);

  const updateWorkHours = (day: number, type: keyof WorkHours, minutes: number) => {
    const workload = monthlyWorkload.find(item => item.day === day);
    if (!workload || workload.isDayOff) return;

    setWorkByDay(current => {
      const availableMinutes = Math.max(0, MAX_WEEKDAY_MINUTES - Math.round(workload.total * 60));
      const existing = resolvedWorkByDay.get(day) ?? { science: 0, methodical: 0, organizational: 0 };
      // A direct edit must not rebalance another category: the displayed total
      // should immediately reflect the value entered by the user.
      const next = { ...existing, [type]: clamp(minutes, 0, availableMinutes) };

      return { ...current, [day]: next };
    });
  };

  const shiftScienceMethodical = (day: number, deltaMinutes: number) => {
    const workload = monthlyWorkload.find(item => item.day === day);
    if (!workload || workload.isDayOff) return;

    const work = resolvedWorkByDay.get(day);
    if (!work) return;

    const availableMinutes = Math.max(0, MAX_WEEKDAY_MINUTES - Math.round(workload.total * 60));
    const totalPairMinutes = Math.max(0, availableMinutes - work.organizational);

    if (totalPairMinutes <= 0) return;

    const nextScience = clamp(work.science + deltaMinutes, 0, totalPairMinutes);
    const nextMethodical = totalPairMinutes - nextScience;

    if (nextScience === work.science) return;

    setWorkByDay(current => ({
      ...current,
      [day]: {
        science: nextScience,
        methodical: nextMethodical,
        organizational: work.organizational,
      },
    }));
  };

  const swapScienceAndMethodical = (day: number) => {
    const workload = monthlyWorkload.find(item => item.day === day);
    if (!workload || workload.isDayOff) return;

    const currentWork = resolvedWorkByDay.get(day);
    if (!currentWork) return;

    setWorkByDay(prev => ({
      ...prev,
      [day]: {
        science: currentWork.methodical,
        methodical: currentWork.science,
        organizational: currentWork.organizational,
      },
    }));
  };

  const totalForDays = (days: DailyWorkload[]) =>
    days.reduce(
      (total, item) => {
        const work = resolvedWorkByDay.get(item.day) ?? { science: 0, methodical: 0, organizational: 0 };
        total.teaching += Math.round(item.total * 60);
        total.science += work.science;
        total.methodical += work.methodical;
        total.organizational += work.organizational;
        return total;
      },
      { teaching: 0, science: 0, methodical: 0, organizational: 0 },
    );

  const firstHalfTotals = totalForDays(monthlyWorkload.slice(0, 15));
  const secondHalfTotals = totalForDays(monthlyWorkload.slice(15));
  const monthlyTotals = {
    teaching: firstHalfTotals.teaching + secondHalfTotals.teaching,
    science: firstHalfTotals.science + secondHalfTotals.science,
    methodical: firstHalfTotals.methodical + secondHalfTotals.methodical,
    organizational: firstHalfTotals.organizational + secondHalfTotals.organizational,
  };

  const renderDurationInputs = (day: number, type: keyof WorkHours, minutes: number, disabled: boolean) => (
    <Group className="work-duration" gap={2} wrap="nowrap">
      <NumberInput
        aria-label={`${workTypeLabels[type]} години для дня ${day}`}
        value={Math.floor(minutes / 60)}
        onChange={value => updateWorkHours(day, type, (Number(value) || 0) * 60 + (minutes % 60))}
        min={0}
        max={7}
        hideControls
        disabled={disabled}
      />
      <Text size="xs">:</Text>
      <NumberInput
        aria-label={`${workTypeLabels[type]} хвилини для дня ${day}`}
        value={minutes % 60}
        onChange={value => updateWorkHours(day, type, Math.floor(minutes / 60) * 60 + (Number(value) || 0))}
        min={0}
        max={59}
        hideControls
        disabled={disabled}
      />
    </Group>
  );

  useEffect(() => {
    if (!selectedChairId || !selectedTeacherId || !reportMonth) {
      setSchedule([]);
      setReportState("idle");
      return;
    }

    const params = new URLSearchParams({
      startDate: `${startDate}T00:00:00`,
      endDate: `${endDate}T23:59:59`,
    });
    let isActive = true;
    setSchedule([]);
    setReportState("loading");
    setError("");

    apiGet<ScheduleItem[]>(
      `/api/work-hours/structures/${STRUCTURE_ID}/chairs/${selectedChairId}/teachers/${selectedTeacherId}/schedule?${params}`,
    )
      .then(items => {
        if (!isActive) return;
        setSchedule(items);
        setReportState("ready");
      })
      .catch(caught => {
        if (!isActive) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setReportState("error");
      });

    return () => {
      isActive = false;
    };
  }, [endDate, reportMonth, selectedChairId, selectedTeacherId, startDate]);

  return (
    <Container component="main" size="xl" py="xl" className="teacher-work-hours-page">
      <Stack gap="lg">
        <Group className="no-print" justify="space-between" align="flex-end">
          <div>
            <Title id="page-title" order={1}>Табель навантаження</Title>
            {teacher && <Text c="dimmed">{teacher.name}</Text>}
          </div>
          <Group gap="xs">
            <Select aria-label="Місяць" data={monthOptions} value={selectedMonth} onChange={value => value && updateReportMonth(selectedYear, value)} w={150} />
            <Select aria-label="Рік" data={yearOptions} value={selectedYear} onChange={value => value && updateReportMonth(value, selectedMonth)} w={100} />
            <Tooltip label="Надрукувати сформований звіт"><Button variant="default" leftSection={<FontAwesomeIcon icon={faPrint} />} onClick={() => window.print()} disabled={!sortedSchedule.length}>Друк</Button></Tooltip>
          </Group>
        </Group>

        <Paper className="no-print" withBorder p="md" radius="sm" aria-label="Фільтри звіту">
          <Stack gap="md">
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c="dimmed">Наука: {sciencePercentage}% / Методична робота: {100 - sciencePercentage}%</Text>
              </Group>
              <Slider value={sciencePercentage} onChange={setSciencePercentage} min={0} max={100} label={value => `${value}% науки`} />
            </div>
          </Stack>
        </Paper>

        {error && <Alert className="no-print" color="red" title="Не вдалося завантажити звіт">{error}</Alert>}
        {reportState === "loading" && <Group className="no-print"><Loader size="sm" /><Text size="sm" c="dimmed">Оновлення розкладу...</Text></Group>}

        <Modal opened={needsMkrSelection} onClose={() => navigate(`/teachers/${id}`)} title="Виберіть викладача в МКР" centered closeOnClickOutside={false}>
          <Stack>
            <Text size="sm" c="dimmed">Цей вибір збережеться для табеля {teacher?.name}.</Text>
            {directoryState === "loading" ? <Loader size="sm" /> : (
              <>
                <Select
                  label="Кафедра"
                  placeholder="Оберіть кафедру"
                  data={chairs.map((chair) => ({ value: String(chair.id), label: chair.name }))}
                  value={selectedChairId || null}
                  onChange={(value) => { setSelectedChairId(value ?? ""); setSelectedTeacherId(""); }}
                  searchable
                />
                <Select
                  label="Викладач"
                  placeholder="Оберіть викладача"
                  data={mkrTeachers.map((mkrTeacher) => ({ value: String(mkrTeacher.id), label: mkrTeacher.name }))}
                  value={selectedTeacherId || null}
                  onChange={(value) => setSelectedTeacherId(value ?? "")}
                  disabled={!selectedChairId}
                  searchable
                />
              </>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate(`/teachers/${id}`)}>Скасувати</Button>
              <Button onClick={saveMkrSelection} loading={isSavingMkr} disabled={!selectedChairId || !selectedTeacherId}>Відкрити табель</Button>
            </Group>
          </Stack>
        </Modal>

      {reportState === "ready" && (
        <section className="form-preview" aria-labelledby="form-preview-title">
          <div className="form-preview-scroll">
            <table className="workload-form">
              <thead>
                <tr>
                  <th rowSpan={2}>День</th>
                  <th colSpan={5}>Навчальне навантаження</th>
                  <th rowSpan={2}>Викладання</th>
                  <th rowSpan={2}>Наука</th>
                  <th rowSpan={2}>Методична робота</th>
                  <th rowSpan={2}>Організаційна робота</th>
                  <th rowSpan={2}>Загалом</th>
                </tr>
                <tr>
                  {['I', 'II', 'III', 'IV', 'V'].map(slot => <th key={slot}>{slot}</th>)}
                </tr>
              </thead>
              <tbody>
                {monthlyWorkload.map((item, index) => {
                  const work = resolvedWorkByDay.get(item.day) ?? { science: 0, methodical: 0, organizational: 0 };
                  const totalMinutes = Math.round(item.total * 60) + work.science + work.methodical + work.organizational;
                  const hasIncorrectTotal = !item.isDayOff && totalMinutes !== MAX_WEEKDAY_MINUTES;
                  const rowClassNames = [item.isDayOff ? "weekend-row" : "", hasIncorrectTotal ? "over-limit" : ""]
                    .filter(Boolean)
                    .join(" ") || undefined;

                  return (
                    <Fragment key={item.day}>
                      <tr className={rowClassNames}>
                      <td>
                        <Group gap="xs" wrap="nowrap">
                          <span>{item.day}</span>
                          {!item.isWeekend && (
                            <Checkbox
                              aria-label={`Позначити день ${item.day} як вихідний`}
                              checked={additionalDaysOff.has(item.day)}
                              onChange={event => {
                                const isChecked = event.currentTarget.checked;
                                setAdditionalDaysOff(current => {
                                  const next = new Set(current);
                                  if (isChecked) next.add(item.day);
                                  else next.delete(item.day);
                                  return next;
                                });
                              }}
                            />
                          )}
                        </Group>
                      </td>
                      {item.slots.map((hours, slot) => (
                        <td key={slot}>
                          {item.isDayOff ? "вх" : hours ? (
                            <span className="lesson-hours">{formatDuration(hours * 60)}</span>
                          ) : ""}
                        </td>
                      ))}
                      <td className="workload-total">
                        {item.isDayOff ? "вх" : (
                          <Tooltip label={item.explanation || "Немає деталей заняття"} multiline w={360} withArrow>
                            <span className="lesson-hours">{formatDuration(item.total * 60)}</span>
                          </Tooltip>
                        )}
                      </td>
                      {item.isDayOff ? (
                        <>
                          <td>вх</td>
                          <td>вх</td>
                          <td>вх</td>
                        </>
                      ) : (
                        <>
                          <td>
                            <Group gap={4} wrap="nowrap" align="center" className="science-input">
                              {renderDurationInputs(item.day, "science", work.science, false)}
                              <Tooltip label={`Передати ${formatDuration(WORK_SHIFT_MINUTES)} з науки до методики`} withArrow>
                                <ActionIcon
                                  variant="light"
                                  size="sm"
                                  aria-label={`Передати ${formatDuration(WORK_SHIFT_MINUTES)} з наукової роботи до методичної для дня ${item.day}`}
                                  onClick={() => shiftScienceMethodical(item.day, -WORK_SHIFT_MINUTES)}
                                >
                                  <Text size="xs" fw={700} className="shift-button-text">»</Text>
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </td>
                          <td>
                            <Group gap={4} wrap="nowrap" align="center" className="methodical-input">
                              <Tooltip label={`Передати ${formatDuration(WORK_SHIFT_MINUTES)} з методики до науки`} withArrow>
                                <ActionIcon
                                  variant="light"
                                  size="sm"
                                  aria-label={`Передати ${formatDuration(WORK_SHIFT_MINUTES)} з методичної роботи до наукової для дня ${item.day}`}
                                  onClick={() => shiftScienceMethodical(item.day, WORK_SHIFT_MINUTES)}
                                >
                                  <Text size="xs" fw={700} className="shift-button-text">«</Text>
                                </ActionIcon>
                              </Tooltip>
                              {renderDurationInputs(item.day, "methodical", work.methodical, false)}
                            </Group>
                          </td>
                          <td>{renderDurationInputs(item.day, "organizational", work.organizational, false)}</td>
                        </>
                      )}
                      <td className={`workload-total${hasIncorrectTotal ? " workload-total-over" : ""}`}>
                        {item.isDayOff ? "вх" : formatDuration(totalMinutes)}
                      </td>
                    </tr>
                    {index === 14 && (
                      <tr className="workload-subtotal">
                        <td colSpan={6}>Підсумок за 1–15 дні</td>
                        <td>{formatDuration(firstHalfTotals.teaching)}</td>
                        <td>{formatDuration(firstHalfTotals.science)}</td>
                        <td>{formatDuration(firstHalfTotals.methodical)}</td>
                        <td>{formatDuration(firstHalfTotals.organizational)}</td>
                        <td>{formatDuration(firstHalfTotals.teaching + firstHalfTotals.science + firstHalfTotals.methodical + firstHalfTotals.organizational)}</td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="workload-subtotal">
                  <td colSpan={6}>Підсумок за 16–{monthlyWorkload.length} дні</td>
                  <td>{formatDuration(secondHalfTotals.teaching)}</td>
                  <td>{formatDuration(secondHalfTotals.science)}</td>
                  <td>{formatDuration(secondHalfTotals.methodical)}</td>
                  <td>{formatDuration(secondHalfTotals.organizational)}</td>
                  <td>{formatDuration(secondHalfTotals.teaching + secondHalfTotals.science + secondHalfTotals.methodical + secondHalfTotals.organizational)}</td>
                </tr>
                <tr className="workload-grand-total">
                  <td colSpan={6}>Місячний підсумок</td>
                  <td>{formatDuration(monthlyTotals.teaching)}</td>
                  <td>{formatDuration(monthlyTotals.science)}</td>
                  <td>{formatDuration(monthlyTotals.methodical)}</td>
                  <td>{formatDuration(monthlyTotals.organizational)}</td>
                  <td>{formatDuration(monthlyTotals.teaching + monthlyTotals.science + monthlyTotals.methodical + monthlyTotals.organizational)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      </Stack>
    </Container>
  );
}

export default App;
