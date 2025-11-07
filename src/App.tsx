import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import CoursesList from "./client/pages/CoursesList";
import GeneratorPage from "./client/pages/GeneratorPage";
import TeachersList from "./client/pages/TeachersList";
import TeacherEdit from "./client/pages/TeacherEdit";
import CourseEdit from "./client/pages/CourseEdit";
import ResultsList from "./client/pages/ResultsList";
import ResultEdit from "./client/pages/ResultEdit";
import TemplatesList from "./client/pages/TemplatesList";
import TemplateEdit from "./client/pages/TemplateEdit";
import TopicGeneratedDataEdit from "./client/pages/TopicGeneratedDataEdit";
import CourseGeneratedDataEdit from "./client/pages/CourseGeneratedDataEdit";
import PromptsList from "./client/pages/PromptsList";

function Navigation() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const linkClassName = (isActive: boolean) => 
    `font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
      isActive
        ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
        : "text-[#fbf0df] hover:bg-[#2a2a2a]"
    }`;

  return (
    <nav className="bg-[#1a1a1a] border-b-2 border-[#fbf0df] mb-4">
      <div className="max-w-7xl mx-auto px-4">
        {/* Mobile header with hamburger */}
        <div className="flex items-center justify-between p-4 md:hidden">
          <button
            onClick={toggleMenu}
            className="text-[#fbf0df] hover:text-white transition-colors p-2"
            aria-label="Toggle menu"
          >
            <FontAwesomeIcon icon={isMenuOpen ? faTimes : faBars} size="lg" />
          </button>
        </div>

        {/* Desktop menu */}
        <div className="hidden md:flex gap-4 p-4">
          <Link
            to="/"
            onClick={closeMenu}
            className={linkClassName(location.pathname === "/")}
          >
            Генератор документів
          </Link>        
          <Link
            to="/courses"
            onClick={closeMenu}
            className={linkClassName(location.pathname.startsWith("/courses"))}
          >
            Дисципліни
          </Link>
          <Link
            to="/teachers"
            onClick={closeMenu}
            className={linkClassName(location.pathname.startsWith("/teachers"))}
          >
            Викладачі
          </Link>
          <Link
            to="/results"
            onClick={closeMenu}
            className={linkClassName(location.pathname.startsWith("/results"))}
          >
            Результати
          </Link>
          <Link
            to="/templates"
            onClick={closeMenu}
            className={linkClassName(location.pathname.startsWith("/templates"))}
          >
            Шаблони
          </Link>
          <Link
            to="/prompts"
            onClick={closeMenu}
            className={linkClassName(location.pathname.startsWith("/prompts"))}
          >
            Промпти
          </Link>        
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Link
              to="/"
              onClick={closeMenu}
              className={linkClassName(location.pathname === "/")}
            >
              Генератор документів
            </Link>        
            <Link
              to="/courses"
              onClick={closeMenu}
              className={linkClassName(location.pathname.startsWith("/courses"))}
            >
              Дисципліни
            </Link>
            <Link
              to="/teachers"
              onClick={closeMenu}
              className={linkClassName(location.pathname.startsWith("/teachers"))}
            >
              Викладачі
            </Link>
            <Link
              to="/results"
              onClick={closeMenu}
              className={linkClassName(location.pathname.startsWith("/results"))}
            >
              Результати
            </Link>
            <Link
              to="/templates"
              onClick={closeMenu}
              className={linkClassName(location.pathname.startsWith("/templates"))}
            >
              Шаблони
            </Link>
            <Link
              to="/prompts"
              onClick={closeMenu}
              className={linkClassName(location.pathname.startsWith("/prompts"))}
            >
              Промпти
            </Link>        
          </div>
        </div>
      </div>
    </nav>
  );
}

export function App() {
  return (
    <div className="w-full min-h-screen">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a1a',
            color: '#fbf0df',
            border: '2px solid #fbf0df',
            fontFamily: 'monospace',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fbf0df',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fbf0df',
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
        <Route path="/courses/:id" element={<CourseEdit />} />
        <Route path="/courses/:courseId/generated" element={<CourseGeneratedDataEdit />} />
        <Route path="/courses/:courseId/topics/:topicId/generated" element={<TopicGeneratedDataEdit />} />
        <Route path="/teachers" element={<TeachersList />} />
        <Route path="/teachers/:id" element={<TeacherEdit />} />
        <Route path="/results" element={<ResultsList />} />
        <Route path="/results/:id" element={<ResultEdit />} />
        <Route path="/templates" element={<TemplatesList />} />
        <Route path="/templates/:id" element={<TemplateEdit />} />
        <Route path="/prompts" element={<PromptsList />} />
      </Routes>
    </div>
  );
}

export default App;
