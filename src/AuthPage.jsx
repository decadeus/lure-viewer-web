import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import "./App.css";

export default function AuthPage() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!initializing && user) {
    navigate("/");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      let authError = null;

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        authError = error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        authError = error;
      }

      if (authError) {
        setError(authError.message || "Erreur d'authentification.");
        return;
      }

      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h1 className="auth-title">
          {mode === "signin" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="auth-subtitle">
          Utilise ton email et mot de passe Supabase pour te connecter.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="primary-btn auth-submit"
            disabled={loading}
          >
            {loading
              ? "En cours..."
              : mode === "signin"
                ? "Se connecter"
                : "Créer le compte"}
          </button>
        </form>

        <button
          type="button"
          className="auth-mode-toggle"
          onClick={() =>
            setMode((m) => (m === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin"
            ? "Pas encore de compte ? Créer un compte"
            : "Déjà un compte ? Se connecter"}
        </button>

        <button
          type="button"
          className="auth-back-home"
          onClick={() => navigate("/")}
        >
          Retour à la liste des leurres
        </button>
      </div>
    </div>
  );
}


