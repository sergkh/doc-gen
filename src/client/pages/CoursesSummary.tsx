import { useEffect, useMemo, useState } from "react";
import type { Course, CourseTopic } from "@/stores/models";
import { formatDisciplineCode, loadAllCoursesWithTopics, loadCoursesBySpecialty } from "../courses";
import { useParams } from "react-router-dom";

type CourseWithTopics = Course & { topics: CourseTopic[] };

type CourseHoursSummary = {
  id: number;
  code: string;
  name: string;
  lectures: number;
  practicals: number;
  total: number;
  lecturesPercent: number;
  practicalsPercent: number;
};

const formatHours = (value: number): string =>
  value.toLocaleString("uk-UA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const calculateCourseHours = (course: CourseWithTopics): CourseHoursSummary => {
  const topics = course.topics ?? [];

  const lectures = topics.reduce((sum, topic) => sum + (topic.data?.fulltime?.hours ?? 0), 0);
  const practicals = topics.reduce((sum, topic) => sum + (topic.data?.fulltime?.practical_hours ?? 0), 0);
  const total = lectures + practicals;
  const lecturesPercent = total > 0 ? (lectures / total) * 100 : 0;
  const practicalsPercent = total > 0 ? (practicals / total) * 100 : 0;

  return {
    id: course.id,
    code: formatDisciplineCode(course.data.ok_no),
    name: course.name,
    lectures,
    practicals,
    total,
    lecturesPercent,
    practicalsPercent,
  };
};

export default function CoursesSummary() {
  const { specialtyId } = useParams<{ specialtyId: string }>()
  const [courses, setCourses] = useState<CourseWithTopics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!specialtyId) {
      setError("Не вказано спеціальність");
      setIsLoading(false);
      return;
    }

    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAllCoursesWithTopics(Number(specialtyId));
        setCourses(data);
      } catch (err) {
        console.error("Failed to load courses summary:", err);
        setError("Не вдалося завантажити дисципліни");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [specialtyId]);

  const summary = useMemo(() => {
    const perCourse = courses.map(calculateCourseHours);
    const totalLectures = perCourse.reduce((sum, item) => sum + item.lectures, 0);
    const totalPracticals = perCourse.reduce((sum, item) => sum + item.practicals, 0);
    const totalHours = totalLectures + totalPracticals;
    const lecturesShare = totalHours > 0 ? (totalLectures / totalHours) * 100 : 0;
    const practicalsShare = totalHours > 0 ? (totalPracticals / totalHours) * 100 : 0;

    return {
      perCourse,
      totalLectures,
      totalPracticals,
      totalHours,
      lecturesShare,
      practicalsShare,
    };
  }, [courses]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-amber-50 font-mono">Завантаження зведення...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-red-500 font-mono">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-zinc-900 border-2 border-amber-50 rounded-xl px-4 py-2 text-amber-50 font-mono hover:bg-zinc-800 transition-colors"
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
        <div className="mt-8 mx-auto w-full text-left">
          <div className="text-amber-50 font-mono">Немає дисциплін для зведення</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-2xl">Зведення за годинами дисциплін</h1>
          <p className="text-amber-100 font-mono text-sm">
            Підсумовані лекційні та практичні години для всіх дисциплін (денна форма навчання).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
            <div className="text-sm opacity-70">Кількість дисциплін</div>
            <div className="text-3xl font-bold mt-2">{courses.length}</div>
          </div>
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">Лекції</span>
              <span className="text-sm text-amber-200">{formatPercent(summary.lecturesShare)}</span>
            </div>
            <div className="text-3xl font-bold mt-2">{formatHours(summary.totalLectures)}</div>
            <div className="w-full h-2 bg-zinc-800 rounded-full mt-3">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${summary.lecturesShare}%` }}
              />
            </div>
          </div>
          <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">Практичні</span>
              <span className="text-sm text-amber-200">{formatPercent(summary.practicalsShare)}</span>
            </div>
            <div className="text-3xl font-bold mt-2">{formatHours(summary.totalPracticals)}</div>
            <div className="w-full h-2 bg-zinc-800 rounded-full mt-3">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${summary.practicalsShare}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-4 text-amber-50 font-mono">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl">Години за дисциплінами</h2>
            <div className="text-sm text-amber-200">
              Разом: {formatHours(summary.totalHours)} годин
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead>
                <tr className="text-amber-200 text-xs uppercase tracking-wider">
                  <th className="p-2">Код</th>
                  <th className="p-2">Назва дисципліни</th>
                  <th className="p-2 text-right">Лекції</th>
                  <th className="p-2 text-right">Практичні</th>
                  <th className="p-2 text-right">Разом</th>
                  <th className="p-2 text-right">% лекцій</th>
                  <th className="p-2 text-right">% практик</th>
                </tr>
              </thead>
              <tbody>
                {summary.perCourse.map(course => (
                  <tr key={course.id} className="border-t border-zinc-800">
                    <td className="p-2 align-top">{course.code}</td>
                    <td className="p-2 align-top">{course.name}</td>
                    <td className="p-2 text-right align-top">{formatHours(course.lectures)}</td>
                    <td className="p-2 text-right align-top">{formatHours(course.practicals)}</td>
                    <td className="p-2 text-right align-top">{formatHours(course.total)}</td>
                    <td className="p-2 text-right align-top">{formatPercent(course.lecturesPercent)}</td>
                    <td className="p-2 text-right align-top">{formatPercent(course.practicalsPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
