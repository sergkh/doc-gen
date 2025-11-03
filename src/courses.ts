export type Course = {
  id: string;
  title: string;
  credits: number;
  hours: number;
  specialty: string;
  author: string;
};

const STORAGE_KEY = "courses";

export function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCourses(items: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function upsertCourse(item: Course): Course[] {
  const items = loadCourses();
  const idx = items.findIndex(d => d.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  saveCourses(items);
  return items;
}

export function deleteCourse(id: string): Course[] {
  const items = loadCourses().filter(d => d.id !== id);
  saveCourses(items);
  return items;
}


