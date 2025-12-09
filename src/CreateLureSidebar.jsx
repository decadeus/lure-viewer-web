import React, { useRef } from "react";
import { LurePret5PaletteControls } from "./PaletteControls";

// Slider avec 2 curseurs (bas / haut) sur une seule barre, utilisé pour le gradient 3 couleurs
function DualPositionSlider({ min = 0, max = 100, valueLow, valueHigh, onChange }) {
  const trackRef = useRef(null);

  const clampValue = (val) => Math.min(max, Math.max(min, val));

  const handlePointerDown = (which) => (event) => {
    event.preventDefault();
    event.stopPropagation();

    const getClientX = (e) => {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      return e.clientX;
    };

    const move = (moveEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = getClientX(moveEvent);
      const ratio = (clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      const val = clampValue(Math.round(raw));

      let low = valueLow;
      let high = valueHigh;

      if (which === "low") {
        low = Math.min(val, high - 1);
      } else {
        high = Math.max(val, low + 1);
      }

      onChange(low, high);
    };

    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);

    move(event);
  };

  const range = max - min || 1;
  const lowPct = ((valueLow - min) / range) * 100;
  const highPct = ((valueHigh - min) / range) * 100;

  return (
    <div className="dual-range">
      <div className="dual-range-track" ref={trackRef}>
        <div
          className="dual-range-fill"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <button
          type="button"
          className="dual-range-thumb"
          style={{ left: `${lowPct}%` }}
          onMouseDown={handlePointerDown("low")}
          onTouchStart={handlePointerDown("low")}
        />
        <button
          type="button"
          className="dual-range-thumb"
          style={{ left: `${highPct}%` }}
          onMouseDown={handlePointerDown("high")}
          onTouchStart={handlePointerDown("high")}
        />
      </div>
    </div>
  );
}

export function CreateLureSidebar({
  user,
  navigate,
  modelType,
  setModelType,
  runnerType,
  setRunnerType,
  collectionType,
  setCollectionType,
  frontTripleSize,
  setFrontTripleSize,
  backTripleSize,
  setBackTripleSize,
  backPaletteType,
  setBackPaletteType,
  gradientTop,
  setGradientTop,
  gradientMiddle,
  setGradientMiddle,
  gradientBottom,
  setGradientBottom,
  gradientStrength,
  setGradientStrength,
  gradientStrength2,
  setGradientStrength2,
  gradientPosition,
  setGradientPosition,
  gradientPosition2,
  setGradientPosition2,
  maskType,
  setMaskType,
  color,
  setColor,
  paletteType,
  setPaletteType,
  selectedTexture,
  setSelectedTexture,
  textureRotation,
  setTextureRotation,
  error,
  creating,
  onSubmit,
  onLogout,
}) {
  return (
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
                onClick={onLogout}
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

      <form onSubmit={onSubmit}>
        <section className="panel" style={{ marginBottom: 12 }}>
          <h2 className="panel-title">Type de leurre</h2>
          <div className="color-picker-row">
            <span>Modèle</span>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              style={{ flex: 1, padding: "6px 8px" }}
            >
              {["LurePret5"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </section>

        {modelType !== "LurePret5" && (
          <section className="panel" style={{ marginBottom: 12 }}>
            <h2 className="panel-title">Type de nage</h2>
            <div className="home-type-filters">
              {["SlallowRunner", "MediumRunner", "DeepRunner"].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`home-type-filter-btn${
                    runnerType === type ? " home-type-filter-btn--active" : ""
                  }`}
                  onClick={() => setRunnerType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Anciennes collections Lure25-29 désactivées pour le moment */}
        {false && (
          <section className="panel">
            <h2 className="panel-title">Collection (Palette / Hoo_B)</h2>
            <div className="home-type-filters">
              {[
                { key: "Palette", label: "Palette" },
                { key: "Hoo_B", label: "Hoo_B" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`home-type-filter-btn${
                    collectionType === opt.key
                      ? " home-type-filter-btn--active"
                      : ""
                  }`}
                  onClick={() => setCollectionType(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {modelType === "LurePret5" && (
          <LurePret5PaletteControls
            frontTripleSize={frontTripleSize}
            setFrontTripleSize={setFrontTripleSize}
            backPaletteType={backPaletteType}
            setBackPaletteType={setBackPaletteType}
            backTripleSize={backTripleSize}
            setBackTripleSize={setBackTripleSize}
          />
        )}

        {/* Panneau textures (choix + angle) */}
        <section className="panel">
          <h2 className="panel-title">Texture Pike</h2>
          <div className="texture-list">
            {[
              { key: "/textures/Pike-002.png", name: "Pike 1" },
              { key: "/textures/Pike_003.png", name: "Pike 2" },
            ].map((tex) => (
              <button
                key={tex.key}
                type="button"
                className={`texture-item${
                  selectedTexture === tex.key ? " texture-item--active" : ""
                }`}
                onClick={() =>
                  setSelectedTexture((current) =>
                    current === tex.key ? null : tex.key,
                  )
                }
              >
                <div className="texture-thumb texture-thumb--pike" />
                <div className="texture-meta">
                  <span className="texture-name">{tex.name}</span>
                  <span className="texture-tag">
                    {selectedTexture === tex.key
                      ? "Utilisée sur le leurre"
                      : "Cliquer pour appliquer"}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="color-picker-row" style={{ marginTop: 12 }}>
            <span>Angle texture</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={textureRotation}
              onChange={(e) => setTextureRotation(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ width: 48, textAlign: "right" }}>
              {textureRotation}°
            </span>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Couleur du leurre</h2>
          {modelType === "LurePret5" ||
          modelType === "Lure11" ||
          modelType === "Lure12" ||
          modelType === "Lure13" ||
          modelType === "Lure14" ||
          modelType === "Lure15" ||
          modelType === "Lure16" ||
          modelType === "Lure17" ||
          modelType === "Lure18" ||
          modelType === "Lure19" ||
          modelType === "Lure20" ||
          modelType === "Lure21" ||
          modelType === "Lure22" ||
          modelType === "Lure29" ? (
            <>
              <div className="color-picker-row">
                <span>Couleur haut</span>
                <input
                  type="color"
                  value={gradientTop}
                  onChange={(e) => setGradientTop(e.target.value)}
                />
              </div>
              <div className="color-picker-row">
                <span>Couleur milieu</span>
                <input
                  type="color"
                  value={gradientMiddle}
                  onChange={(e) => setGradientMiddle(e.target.value)}
                />
              </div>
              <div className="color-picker-row">
                <span>Couleur bas</span>
                <input
                  type="color"
                  value={gradientBottom}
                  onChange={(e) => setGradientBottom(e.target.value)}
                />
              </div>
              <div className="color-picker-row" style={{ marginTop: 12 }}>
                <span>Degré dégradé haut</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={gradientStrength}
                  onChange={(e) => setGradientStrength(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: 40, textAlign: "right" }}>
                  {gradientStrength}
                </span>
              </div>
              <div className="color-picker-row" style={{ marginTop: 8 }}>
                <span>Degré dégradé bas</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={gradientStrength2}
                  onChange={(e) =>
                    setGradientStrength2(Number(e.target.value))
                  }
                  style={{ flex: 1 }}
                />
                <span style={{ width: 40, textAlign: "right" }}>
                  {gradientStrength2}
                </span>
              </div>
              <div className="color-picker-row" style={{ marginTop: 8 }}>
                <span>Positions B / H</span>
                <div style={{ flex: 1 }}>
                  <DualPositionSlider
                    valueLow={gradientPosition2}
                    valueHigh={gradientPosition}
                    onChange={(low, high) => {
                      setGradientPosition2(low);
                      setGradientPosition(high);
                    }}
                  />
                </div>
              </div>
              {(modelType === "Lure17" ||
                modelType === "Lure18" ||
                modelType === "Lure19" ||
                modelType === "Lure20" ||
                modelType === "Lure21" ||
                modelType === "Lure22") && (
                <div className="color-picker-row" style={{ marginTop: 8 }}>
                  <span>Mask</span>
                  <div className="home-type-filters" style={{ flex: 1 }}>
                    {[
                      { key: "none", label: "Aucun" },
                      { key: "pike", label: "Pike" },
                      { key: "card", label: "Points" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`home-type-filter-btn${
                          maskType === opt.key
                            ? " home-type-filter-btn--active"
                            : ""
                        }`}
                        onClick={() => setMaskType(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="color-picker-row">
              <span>Couleur</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          )}
          {modelType === "CollectionTest" && (
            <div className="color-picker-row" style={{ marginTop: 8 }}>
              <span>Type de palette</span>
              <div className="home-type-filters" style={{ flex: 1 }}>
                {["Palette_H", "Palette_M"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`home-type-filter-btn${
                      paletteType === type
                        ? " home-type-filter-btn--active"
                        : ""
                    }`}
                    onClick={() => setPaletteType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
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
  );
}


