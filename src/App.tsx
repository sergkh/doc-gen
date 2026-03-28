import "@mantine/core/styles.css";
import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import {
  MantineProvider,
  Anchor,
  Box,
  Burger,
  Collapse,
  Container,
  Group,
  Stack,
} from "@mantine/core";
import CoursesList from "./client/pages/CoursesList";
import GeneratorPage from "./client/pages/GeneratorPage";
import TeachersList from "./client/pages/TeachersList";
import TeacherEdit from "./client/pages/TeacherEdit";
import CourseEdit from "./client/pages/CourseEdit";
import ResultEdit from "./client/pages/ResultEdit";
import ResultsMatrix from "./client/pages/ResultsMatrix";
import CoursesWithResults from "./client/pages/CoursesWithResults";
import CourseGraph from "./client/pages/CourseGraph";
import CoursesSummary from "./client/pages/CoursesSummary";
import TemplatesList from "./client/pages/TemplatesList";
import TemplateEdit from "./client/pages/TemplateEdit";
import TopicGeneratedDataEdit from "./client/pages/TopicGeneratedDataEdit";
import CourseGeneratedDataEdit from "./client/pages/CourseGeneratedDataEdit";
import SpecialtiesList from "./client/pages/SpecialtiesList";
import SpecialtyEdit from "./client/pages/SpecialtyEdit";
import ChatPage from "./client/pages/ChatPage";
import { theme } from "./theme";

function Navigation() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const linkStyles = (isActive: boolean) => ({
    // display: "inline-flex",
    // alignItems: "center",
    // borderRadius: "0.5rem",
    // padding: "0.5rem 1rem",
    // transition: "all 100ms",
    // fontFamily: "monospace",
    // fontWeight: isActive ? 700 : 400,
    // color: isActive ? "#18181b" : "#fffbeb",
    // backgroundColor: isActive ? "#fffbeb" : "transparent",
    // textDecoration: "none",
  });

  return (
    <Box component="nav" style={{ borderBottom: "2px solid #fffbeb", marginBottom: "1rem" }}>
      <Container size="xl" px="md">
        <Group justify="space-between" py="md" hiddenFrom="md">
          <Box c="#fffbeb" fw={700} ff="monospace">
            Меню
          </Box>
          <Burger
            opened={isMenuOpen}
            onClick={() => setIsMenuOpen((opened) => !opened)}
            color="#fffbeb"
            aria-label="Toggle menu"
          />
        </Group>

        <Group gap="sm" py="md" visibleFrom="md">
          <Anchor component={Link} to="/" onClick={closeMenu} style={linkStyles(location.pathname === "/")}>Генератор документів</Anchor>
          <Anchor component={Link} to="/courses" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/courses"))}>Дисципліни</Anchor>
          <Anchor component={Link} to="/teachers" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/teachers"))}>Викладачі</Anchor>
          <Anchor component={Link} to="/specialties" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/specialties"))}>Спеціальності</Anchor>
          <Anchor component={Link} to="/templates" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/templates"))}>Шаблони</Anchor>
          <Anchor component={Link} to="/chat" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/chat"))}>Чат</Anchor>
        </Group>

        <Collapse in={isMenuOpen} hiddenFrom="md">
          <Stack gap="xs" pb="md">
            <Anchor component={Link} to="/" onClick={closeMenu} style={linkStyles(location.pathname === "/")}>Генератор документів</Anchor>
            <Anchor component={Link} to="/courses" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/courses"))}>Дисципліни</Anchor>
            <Anchor component={Link} to="/teachers" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/teachers"))}>Викладачі</Anchor>
            <Anchor component={Link} to="/specialties" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/specialties"))}>Спеціальності</Anchor>
            <Anchor component={Link} to="/results" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/results"))}>Результати</Anchor>
            <Anchor component={Link} to="/templates" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/templates"))}>Шаблони</Anchor>
            <Anchor component={Link} to="/chat" onClick={closeMenu} style={linkStyles(location.pathname.startsWith("/chat"))}>Чат</Anchor>
          </Stack>
        </Collapse>
      </Container>
    </Box>
  );
}

export function App() {
  return (
    <MantineProvider theme={theme}>
      <Box w="100%" mih="100vh">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#18181b',
              color: '#fffbeb',
              border: '2px solid #fffbeb',
              fontFamily: 'monospace',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fffbeb',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fffbeb',
              },
            },
          }}
        />
        <Navigation />
        <Routes>
          <Route
            path="/"
            element={<GeneratorPage />}
          />
            <Route path="/courses" element={<CoursesList />} />
            <Route path="/specialties/:specialtyId/courses/summary" element={<CoursesSummary />} />
            <Route path="/specialties/:specialtyId/courses/results" element={<CoursesWithResults />} />
            <Route path="/specialties/:specialtyId/courses/graph" element={<CourseGraph />} />

            <Route path="/courses/:id" element={<CourseEdit />} />
            <Route path="/courses/:courseId/generated" element={<CourseGeneratedDataEdit />} />
            <Route path="/courses/:courseId/topics/:topicId/generated" element={<TopicGeneratedDataEdit />} />
            <Route path="/teachers" element={<TeachersList />} />
            <Route path="/teachers/:id" element={<TeacherEdit />} />
            <Route path="/specialties" element={<SpecialtiesList />} />
            <Route path="/specialties/:id" element={<SpecialtyEdit />} />
            <Route path="/results/matrix" element={<ResultsMatrix />} />
            <Route path="/specialties/:specialtyId/results/:id" element={<ResultEdit />} />
            <Route path="/results/:id" element={<ResultEdit />} />
            <Route path="/templates" element={<TemplatesList />} />
            <Route path="/templates/:id" element={<TemplateEdit />} />
            <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </Box>
    </MantineProvider>
  );
}

export default App;
