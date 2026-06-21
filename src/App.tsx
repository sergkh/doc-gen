import "@mantine/core/styles.css";
import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  AppShell,
  MantineProvider,
  Burger,
  Group,
  NavLink,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import CoursesList from "./client/pages/CoursesList";
import GeneratorPage from "./client/pages/GeneratorPage";
import TeachersList from "./client/pages/TeachersList";
import TeacherEdit from "./client/pages/TeacherEdit";
import CourseEdit from "./client/pages/CourseEdit";
import ResultEdit from "./client/pages/ResultEdit";
import ResultsMatrix from "./client/pages/ResultsMatrix";
import CoursesWithResults from "./client/pages/CoursesWithResults";
import TemplatesList from "./client/pages/TemplatesList";
import TemplateEdit from "./client/pages/TemplateEdit";
import TopicGeneratedDataEdit from "./client/pages/TopicGeneratedDataEdit";
import CourseGeneratedDataEdit from "./client/pages/CourseGeneratedDataEdit";
import SpecialtiesList from "./client/pages/SpecialtiesList";
import SpecialtyEdit from "./client/pages/SpecialtyEdit";
import { theme } from "./theme";

const navItems = [
  { label: "Генератор", to: "/", match: (path: string) => path === "/" },
  { label: "Дисципліни", to: "/courses", match: (path: string) => path.startsWith("/courses") },
  { label: "Викладачі", to: "/teachers", match: (path: string) => path.startsWith("/teachers") },
  { label: "Спеціальності", to: "/specialties", match: (path: string) => path.startsWith("/specialties") },
  { label: "Шаблони", to: "/templates", match: (path: string) => path.startsWith("/templates") },
];

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const location = useLocation();

  return (
    <MantineProvider theme={theme}>
      <Toaster position="top-right" />
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 300, breakpoint: "sm", collapsed: { desktop: true, mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />            
            <Group justify="space-between" style={{ flex: 1 }}>
              <Text fw={700} size="lg">Doc Gen</Text>
                <Group ml="xl" visibleFrom="sm">
                  {navItems.map((item) => (
                    <Link key={item.to} to={item.to}>{item.label}</Link>
                  ))}
                </Group>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              active={item.match(location.pathname)}
              onClick={close}
            />
          ))}
        </AppShell.Navbar>

        <AppShell.Main>
          <Routes>
            <Route path="/" element={<GeneratorPage />} />
            <Route path="/courses" element={<CoursesList />} />
            <Route path="/specialties/:specialtyId/courses" element={<CoursesList />} />
            <Route path="/specialties/:specialtyId/courses/results" element={<CoursesWithResults />} />
            <Route path="/courses/:id" element={<CourseEdit />} />
            <Route path="/courses/:courseId/generated" element={<CourseGeneratedDataEdit />} />
            <Route path="/courses/:courseId/topics/:topicId/generated" element={<TopicGeneratedDataEdit />} />
            <Route path="/teachers" element={<TeachersList />} />
            <Route path="/teachers/:id" element={<TeacherEdit />} />
            <Route path="/specialties" element={<SpecialtiesList />} />
            <Route path="/specialties/:id" element={<SpecialtyEdit />} />
            <Route path="/specialties/:specialtyId/results/matrix" element={<ResultsMatrix />} />
            <Route path="/specialties/:specialtyId/results/:id" element={<ResultEdit />} />
            <Route path="/results/:id" element={<ResultEdit />} />
            <Route path="/templates" element={<TemplatesList />} />
            <Route path="/templates/:id" element={<TemplateEdit />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
