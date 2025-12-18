import { Routes, Route } from "react-router-dom";
import "./App.css";
import AuthPage from "./AuthPage.jsx";
import CreateLurePage from "./CreateLurePage.jsx";

export default function App() {
  return (
    <Routes>
      {/* On utilise désormais uniquement la page de création comme écran principal */}
      <Route path="/" element={<CreateLurePage />} />
      <Route path="/new" element={<CreateLurePage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}


