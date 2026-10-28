import "@mantine/core/styles.css";
import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  AppShell,
  ActionIcon,
  MantineProvider,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  Tooltip,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { useDisclosure } from "@mantine/hooks";
import CoursesList from "./client/pages/CoursesList";
import GeneratorPage from "./client/pages/GeneratorPage";
import TeachersList from "./client/pages/TeachersList";
import TeacherEdit from "./client/pages/TeacherEdit";
import TeacherWorkHours from "./client/pages/TeacherWorkHours";
import CourseEdit from "./client/pages/CourseEdit";
import CourseHistory from "./client/pages/CourseHistory";
import ResultEdit from "./client/pages/ResultEdit";
import ResultsMatrix from "./client/pages/ResultsMatrix";
import CoursesWithResults from "./client/pages/CoursesWithResults";
import TemplatesList from "./client/pages/TemplatesList";
import TemplateEdit from "./client/pages/TemplateEdit";
import TopicGeneratedDataEdit from "./client/pages/TopicGeneratedDataEdit";
import PracticeGeneratedDataEdit from "./client/pages/PracticeGeneratedDataEdit";
import CourseGeneratedDataEdit from "./client/pages/CourseGeneratedDataEdit";
import CourseTopicTestsEdit from "./client/pages/CourseTopicTestsEdit";
import SpecialtiesList from "./client/pages/SpecialtiesList";
import SpecialtyEdit from "./client/pages/SpecialtyEdit";
import SpecialtyHistory from "./client/pages/SpecialtyHistory";
import InternalPrompts from "./client/pages/InternalPrompts";
import { theme } from "./theme";

const navItems = [
  { label: "Генератор", to: "/", match: (path: string) => path === "/" },
  { label: "Дисципліни", to: "/courses", match: (path: string) => path.startsWith("/courses") },
  { label: "Викладачі", to: "/teachers", match: (path: string) => path.startsWith("/teachers") },
  { label: "Спеціальності", to: "/specialties", match: (path: string) => path.startsWith("/specialties") },
];

const settingsItems = [
  { label: "Шаблони", to: "/templates" },
  { label: "Промпти", to: "/internal-prompts" },
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
              <Group gap="sm">
                <Group ml="xl" visibleFrom="sm">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={{
                        color: item.match(location.pathname) ? "var(--mantine-color-blue-6)" : "inherit",
                        fontWeight: item.match(location.pathname) ? 700 : 500,
                        textDecoration: item.match(location.pathname) ? "underline" : "none",
                        textUnderlineOffset: 4,
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </Group>
                <Menu shadow="md" width={180} position="bottom-end">
                  <Menu.Target>
                    <Tooltip label="Налаштування">
                      <ActionIcon variant="subtle" size="lg" aria-label="Налаштування">
                        <FontAwesomeIcon icon={faGear} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Налаштування</Menu.Label>
                    {settingsItems.map((item) => (
                      <Menu.Item key={item.to} component={Link} to={item.to}>
                        {item.label}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
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
            <Route path="/courses/:courseId/tests" element={<CourseTopicTestsEdit />} />
            <Route path="/courses/:courseId/history" element={<CourseHistory />} />
            <Route path="/courses/:courseId/topics/:topicIndex/generated" element={<TopicGeneratedDataEdit />} />
            <Route path="/courses/:courseId/topics/:topicIndex/practices/:practiceIndex/generated" element={<PracticeGeneratedDataEdit />} />
            <Route path="/teachers" element={<TeachersList />} />
            <Route path="/teachers/:id/timesheet" element={<TeacherWorkHours />} />
            <Route path="/teachers/:id" element={<TeacherEdit />} />
            <Route path="/specialties" element={<SpecialtiesList />} />
            <Route path="/specialties/:id" element={<SpecialtyEdit />} />
            <Route path="/specialties/:specialtyId/history" element={<SpecialtyHistory />} />
            <Route path="/specialties/:specialtyId/results/matrix" element={<ResultsMatrix />} />
            <Route path="/specialties/:specialtyId/results/:id" element={<ResultEdit />} />
            <Route path="/templates" element={<TemplatesList />} />
            <Route path="/templates/:id" element={<TemplateEdit />} />
            <Route path="/internal-prompts" element={<InternalPrompts />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
