import { useEffect, useState, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import "./App.css";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage.jsx";

// ----------- Utilitaires modèle 3D -----------

function getModelPath(modelType) {
  switch (modelType) {
    case "Lure1":
      return "/models/Lure1.glb";
    case "Lure2":
      return "/models/Lure2.glb";
    case "Lure3":
      return "/models/Lure3.glb";
    case "Lure4":
      return "/models/Lure4.glb";
    case "Lure5":
      return "/models/Lure5.glb";
    case "Lure7":
      return "/models/Lure7.glb";
    default:
      return "/models/Lure1.glb";
  }
}

function LureModel({ modelType, color }) {
  const modelPath = getModelPath(modelType);
  const { scene } = useGLTF(modelPath);

  useEffect(() => {
    if (!scene) return;

    if (!scene.userData.normalized) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      scene.position.sub(center);
      const scaleFactor = 1.5 / maxDim;
      scene.scale.setScalar(scaleFactor);
      scene.userData.normalized = true;
    }

    const targetColor = new THREE.Color(color);
    scene.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        child.material.color.copy(targetColor);
      }
    });
  }, [scene, color]);

  return <primitive object={scene} />;
}

useGLTF.preload("/models/Lure1.glb");
useGLTF.preload("/models/Lure2.glb");
useGLTF.preload("/models/Lure3.glb");
useGLTF.preload("/models/Lure4.glb");
useGLTF.preload("/models/Lure5.glb");
useGLTF.preload("/models/Lure7.glb");

// ----------- Page principale : liste de cartes de leurres -----------

function HomePage() {
  const { user, initializing } = useAuth();
  const [lures, setLures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [previewLure, setPreviewLure] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "mine"
  const navigate = useNavigate();

  useEffect(() => {
    if (initializing) return;

    const loadLures = async () => {
      setLoading(true);
      setError("");

      const query = supabase
        .from("lures")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Erreur chargement lures", error);
        setError("Impossible de charger les leurres.");
        setLures([]);
      } else {
        setLures(data ?? []);
      }

      setLoading(false);
    };

    loadLures();
  }, [initializing, user]);

  const handleCreateLure = () => {
    setCreating(true);
    navigate("/new");
  };

  if (initializing) {
    return (
      <div className="home-root">
        <div className="full-page-center">
          <span>Chargement de la session...</span>
        </div>
      </div>
    );
  }

  const visibleLures =
    filterMode === "mine" && user
      ? lures.filter((lure) => lure.user_id === user.id)
      : lures;

  return (
    <div className="home-root">
      <header className="home-header">
        <div className="home-header-left">
          <h1 className="home-title">Mes leurres</h1>
          <p className="home-subtitle">
            Liste de tous les leurres créés. Clique sur une carte pour ouvrir le
            viewer et tester la couleur.
          </p>
        </div>
        <div className="home-header-right">
          {user ? (
            <div className="user-chip">
              <span className="user-email">{user.email}</span>
              <button
                type="button"
                className="user-logout-btn"
                onClick={() => supabase.auth.signOut()}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("/auth")}
            >
              Se connecter
            </button>
          )}
          <div className="home-header-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={handleCreateLure}
              disabled={creating}
            >
              {creating ? "Chargement..." : "Créer un leurre"}
            </button>
          </div>
        </div>
      </header>

      <main className="home-body">
        <aside className="home-sidebar">
          <button
            type="button"
            className={`sidebar-filter-btn${
              filterMode === "all" ? " sidebar-filter-btn--active" : ""
            }`}
            onClick={() => setFilterMode("all")}
          >
            Tous les leurres
          </button>
          {user && (
            <button
              type="button"
              className={`sidebar-filter-btn${
                filterMode === "mine" ? " sidebar-filter-btn--active" : ""
              }`}
              onClick={() => setFilterMode("mine")}
            >
              Mes leurres
            </button>
          )}
        </aside>

        <section className="home-main">
          <div className="home-grid">
            {loading && (
              <p className="lure-list-message">Chargement des leurres...</p>
            )}
            {!loading && error && (
              <p className="lure-list-message lure-list-message--error">
                {error}
              </p>
            )}
            {!loading && !error && visibleLures.length === 0 && (
              <p className="lure-list-message">
                Aucun leurre à afficher pour ce filtre.
              </p>
            )}

            {!loading &&
              !error &&
              visibleLures.map((lure) => (
                <button
                  key={lure.id}
                  type="button"
                  className="lure-card"
                  onClick={() => setPreviewLure(lure)}
                >
                  <div className="lure-card-thumb">
                    {lure.thumbnail_url ? (
                      <img
                        src={lure.thumbnail_url}
                        alt={lure.ide || "Thumbnail leurre"}
                        className="lure-card-thumb-image"
                      />
                    ) : (
                      <div className="lure-card-thumb-fallback" />
                    )}
                  </div>
                  <div className="lure-card-body">
                    <div className="lure-card-header">
                      <h2>{lure.ide || "Leurre sans nom"}</h2>
                      <span className="lure-created-at">
                        {lure.created_at
                          ? new Date(lure.created_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div className="lure-card-info">
                      <span className="lure-meta-item">
                        Modèle : {lure.model_type || "inconnu"}
                      </span>
                      <span className="lure-color-label">
                        Couleur : {lure.color || "-"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      </main>
      {previewLure && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewLure(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {previewLure.ide || "Leurre"} (
                  {previewLure.model_type || "modèle inconnu"})
                </h2>
                <p className="modal-subtitle">
                  Aperçu 3D (lecture seule). Fais tourner le leurre avec la
                  souris.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewLure(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-viewer">
              <Canvas
                className="modal-canvas"
                camera={{ position: [0, 0.5, 2.5], fov: 50 }}
              >
                <ambientLight intensity={0.7} />
                <directionalLight position={[2, 5, 3]} intensity={1.4} />
                <Environment preset="studio" />
                <LureModel
                  modelType={previewLure.model_type}
                  color={previewLure.color || "#ffffff"}
                />
                <OrbitControls enablePan enableZoom />
              </Canvas>
            </div>

            <div className="modal-actions">
              <span className="modal-hint">
                Clique et fais glisser pour tourner, molette pour zoomer. Cette
                popup sert uniquement à visualiser le leurre.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------- Page viewer : gauche 3D, droite sélection + couleur -----------

// NOTE: ViewerPage n'est plus utilisé dans ta navigation actuelle,
// on peut le remettre plus tard si nécessaire.

// ----------- Page création : choisir le type de leurre -----------

function CreateLurePage() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [modelType, setModelType] = useState("Lure1");
  const [color, setColor] = useState("#ff0000");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const glRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (creating) return;

    if (!user) {
      setError("Tu dois être connecté pour créer un leurre.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const payload = {
        color,
        model_type: modelType,
        view: 1,
        user_id: user.id,
      };

      const {
        data: newLure,
        error,
      } = await supabase
        .from("lures")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erreur création leurre", error);
        setError("Impossible de créer ce leurre.");
        return;
      }

      // Générer et uploader un thumbnail basé sur le Canvas
      if (glRef.current && newLure?.id) {
        try {
          const dataUrl = glRef.current.domElement.toDataURL("image/png");
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const filePath = `lures/${newLure.id}.png`;

          const { error: uploadError } = await supabase.storage
            .from("thumbnails")
            .upload(filePath, blob, {
              upsert: true,
              contentType: "image/png",
            });

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("thumbnails").getPublicUrl(filePath);

            if (publicUrl) {
              await supabase
                .from("lures")
                .update({ thumbnail_url: publicUrl })
                .eq("id", newLure.id);
            }
          } else {
            console.error("Erreur upload thumbnail", uploadError);
          }
        } catch (thumbErr) {
          console.error("Erreur génération thumbnail", thumbErr);
        }
      }

      navigate("/");
    } finally {
      setCreating(false);
    }
  };

  if (initializing) {
    return (
      <div className="app-root app-root--dark">
        <div className="full-page-center">
          <span>Chargement de la session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root app-root--dark">
      <div className="viewer-container">
        <Canvas
          className="three-canvas"
          camera={{ position: [0, 0.5, 2.5], fov: 50 }}
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            glRef.current = gl;
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 5, 3]} intensity={1.4} />
          <Environment preset="studio" />
          <LureModel modelType={modelType} color={color} />
          <OrbitControls enablePan enableZoom />
        </Canvas>
      </div>

      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h1 className="app-title">Nouveau leurre</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {user ? (
              <div className="user-chip">
                <span className="user-email">{user.email}</span>
                <button
                  type="button"
                  className="user-logout-btn"
                  onClick={() => supabase.auth.signOut()}
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate("/auth")}
              >
                Se connecter
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("/")}
            >
              Retour à la liste
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <section className="panel" style={{ marginBottom: 12 }}>
            <h2 className="panel-title">Type de leurre</h2>
            <div className="home-type-filters">
              {["Lure1", "Lure2", "Lure3", "Lure4", "Lure5", "Lure7"].map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    className={`home-type-filter-btn${
                      modelType === type ? " home-type-filter-btn--active" : ""
                    }`}
                    onClick={() => setModelType(type)}
                  >
                    {type}
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">Couleur du leurre</h2>
            <div className="color-picker-row">
              <span>Couleur</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            {error && (
              <p className="lure-list-message lure-list-message--error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="primary-btn"
              disabled={creating}
              style={{ marginTop: 12, width: "100%" }}
            >
              {creating ? "Création..." : "Sauvegarder"}
            </button>
          </section>
        </form>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/new" element={<CreateLurePage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}


