import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
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

  return (
    <nav className="bg-[#1a1a1a] border-b-2 border-[#fbf0df] p-4 mb-4">
      <div className="max-w-7xl mx-auto px-4 flex gap-4">
        <Link
          to="/"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname === "/"
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Генератор документів
        </Link>        
        <Link
          to="/courses"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname.startsWith("/courses")
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Дисципліни
        </Link>
        <Link
          to="/teachers"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname.startsWith("/teachers")
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Викладачі
        </Link>
        <Link
          to="/results"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname.startsWith("/results")
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Результати
        </Link>
        <Link
          to="/templates"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname.startsWith("/templates")
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Шаблони
        </Link>
        <Link
          to="/prompts"
          className={`font-mono px-4 py-2 rounded-lg transition-all duration-100 ${
            location.pathname.startsWith("/prompts")
              ? "bg-[#fbf0df] text-[#1a1a1a] font-bold"
              : "text-[#fbf0df] hover:bg-[#2a2a2a]"
          }`}
        >
          Промпти
        </Link>        
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
