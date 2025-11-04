import "./index.css";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import CoursesList from "./client/pages/CoursesList";
import CourseEdit from "./client/pages/CourseEdit";
import GeneratorPage from "./client/pages/GeneratorPage";
import TeachersList from "./client/pages/TeachersList";
import TeacherEdit from "./client/pages/TeacherEdit";

function Navigation() {
  const location = useLocation();

  return (
    <nav className="bg-[#1a1a1a] border-b-2 border-[#fbf0df] p-4 mb-4">
      <div className="max-w-7xl mx-auto flex gap-4">
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
      </div>
    </nav>
  );
}

export function App() {
  return (
    <div>
      <Navigation />
      <Routes>
        <Route
          path="/"
          element={<GeneratorPage />}
        />
        <Route path="/courses" element={<CoursesList />} />
        <Route path="/courses/:id" element={<CourseEdit />} />
        <Route path="/teachers" element={<TeachersList />} />
        <Route path="/teachers/:id" element={<TeacherEdit />} />
      </Routes>
    </div>
  );
}

export default App;
