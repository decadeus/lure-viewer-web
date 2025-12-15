import React, { useRef, useState } from "react";
import { LurePret5PaletteControls } from "./PaletteControls";
import { EyeControls } from "./EyeControls";

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
  bavetteType,
  setBavetteType,
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
  gradientAngle,
  setGradientAngle,
  maskType,
  setMaskType,
  color,
  setColor,
  eyeWhiteColor,
  setEyeWhiteColor,
  eyeIrisColor,
  setEyeIrisColor,
  eyeGlowColor,
  setEyeGlowColor,
  eyeGlowStrength,
  setEyeGlowStrength,
  lureSize,
  setLureSize,
  paletteType,
  setPaletteType,
  selectedTexture,
  setSelectedTexture,
  textureRotation,
  setTextureRotation,
  textureScale,
  setTextureScale,
  textureBlur,
  setTextureBlur,
  textureStrength,
  setTextureStrength,
  scalesStrength,
  setScalesStrength,
  textureRepeat,
  setTextureRepeat,
  textureOffsetU,
  setTextureOffsetU,
  textureOffsetV,
  setTextureOffsetV,
  textureMarkColor,
  setTextureMarkColor,
  textureMarkStrength,
  setTextureMarkStrength,
  hasBavetteSocket,
  activeToolTab,
  setActiveToolTab,
  bavetteOptions,
  showAxes,
  setShowAxes,
  error,
  creating,
  onSubmit,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      {/* Bouton Sauvegarder juste sous l'en-tête */}
      <button
        type="submit"
        form="create-lure-form"
        className="primary-btn"
        disabled={creating}
        style={{ width: "100%" }}
      >
        {creating ? "Création..." : "Sauvegarder"}
      </button>

      <div className="sidebar-main">
        {/* Colonne d'icônes verticale façon Blender */}
        <div className="sidebar-toolstrip">
          {[
            { key: "size", label: "Taille du leurre", icon: "Ta" },
            { key: "triple", label: "Triple / Palette", icon: "T" },
            // Onglet bavette seulement si le modèle courant expose un socket de bavette
            ...(hasBavetteSocket
              ? [{ key: "bavette", label: "Bavette", icon: "Bv" }]
              : []),
            { key: "textures", label: "Textures", icon: "Tx" },
            { key: "colors", label: "Couleurs", icon: "C" },
            { key: "eyes", label: "Yeux", icon: "👁" },
            { key: "view", label: "Affichage / Axes", icon: "Ax" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              title={tab.label}
              className={`sidebar-tool-btn${
                activeToolTab === tab.key ? " sidebar-tool-btn--active" : ""
              }`}
              onClick={() => setActiveToolTab(tab.key)}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Contenu des réglages à droite des icônes */}
        <form
          id="create-lure-form"
          onSubmit={onSubmit}
          className="sidebar-content"
        >
          {/* Onglet Taille du leurre (taille, type de nage, collection) */}
          {activeToolTab === "size" && (
            <>
              <section className="panel" style={{ marginBottom: 12 }}>
                <h2 className="panel-title">Taille du leurre</h2>
                <div className="color-picker-row">
                  <span>Taille</span>
                  <div className="home-type-filters" style={{ flex: 1 }}>
                    {(modelType === "LureDouble" ||
                      modelType === "Shad" ||
                      modelType === "Shad2"
                      ? [
                          { key: "M", label: "M" },
                          { key: "L", label: "L" },
                        ]
                      : [
                          { key: "M", label: "M" },
                          { key: "L", label: "L" },
                          { key: "XL", label: "XL" },
                        ]
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`home-type-filter-btn${
                          lureSize === opt.key
                            ? " home-type-filter-btn--active"
                            : ""
                        }`}
                        onClick={() => setLureSize(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Type de nage pour d'autres modèles (garde la logique existante) */}
              {modelType !== "LurePret5" && (
                <section className="panel" style={{ marginBottom: 12 }}>
                  <h2 className="panel-title">Type de nage</h2>
                  <div className="home-type-filters">
                    {["SlallowRunner", "MediumRunner", "DeepRunner"].map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          className={`home-type-filter-btn${
                            runnerType === type
                              ? " home-type-filter-btn--active"
                              : ""
                          }`}
                          onClick={() => setRunnerType(type)}
                        >
                          {type}
                        </button>
                      ),
                    )}
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
            </>
          )}

          {/* Onglet Triple / Palette */}
          {activeToolTab === "triple" && (
            <section className="panel">
              <h2 className="panel-title">Triple / Palette</h2>
              {(modelType === "LurePret5" ||
                modelType === "Shad" ||
                modelType === "Shad2") && (
                <LurePret5PaletteControls
                  frontTripleSize={frontTripleSize}
                  setFrontTripleSize={setFrontTripleSize}
                  backPaletteType={backPaletteType}
                  setBackPaletteType={setBackPaletteType}
                  backTripleSize={backTripleSize}
                  setBackTripleSize={setBackTripleSize}
                />
              )}
            </section>
          )}

          {/* Onglet Bavette */}
          {activeToolTab === "bavette" && hasBavetteSocket && (
            <section className="panel">
              <h2 className="panel-title">Bavette</h2>
              <div className="home-type-filters">
                {(bavetteOptions || [{ key: null, label: "Aucune" }]).map(
                  (opt) => (
                  <button
                    key={opt.key ?? "none"}
                    type="button"
                    className={`home-type-filter-btn${
                      bavetteType === opt.key
                        ? " home-type-filter-btn--active"
                        : ""
                    }`}
                    onClick={() =>
                      setBavetteType((current) =>
                        current === opt.key ? null : opt.key,
                      )
                    }
                  >
                    {opt.label}
                  </button>
                  ),
                )}
              </div>
              <p className="panel-helper">
                Les bavettes proviennent du pack <code>Pack_Bavette</code> et
                sont alignées automatiquement sur le point d&apos;attache{" "}
                <code>A-Bav</code> présent dans le modèle Blender.
              </p>
            </section>
          )}

          {/* Onglet Textures (uniquement les réglages : la sélection se fait
              désormais dans la colonne de gauche, onglet Assets → Textures) */}
          {activeToolTab === "textures" && (
            <section className="panel">
              <h2 className="panel-title">Textures</h2>
                <>
                  <div className="color-picker-row" style={{ marginTop: 12 }}>
                    <span>Angle texture</span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={textureRotation}
                      onChange={(e) =>
                        setTextureRotation(Number(e.target.value))
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {textureRotation}°
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Taille texture</span>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={textureScale}
                      onChange={(e) => setTextureScale(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      x
                      {textureScale.toFixed(2)}
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Répétition de la texture</span>
                    <div className="home-type-filters" style={{ flex: 1 }}>
                      {[
                        { key: true, label: "Oui (motif répété)" },
                        { key: false, label: "Non (une seule fois)" },
                      ].map((opt) => (
                        <button
                          key={String(opt.key)}
                          type="button"
                          className={`home-type-filter-btn${
                            textureRepeat === opt.key
                              ? " home-type-filter-btn--active"
                              : ""
                          }`}
                          onClick={() => setTextureRepeat(opt.key)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Position horizontale</span>
                    <input
                      type="range"
                      min={-2}
                      max={2}
                      step={0.01}
                      value={textureOffsetU}
                      onChange={(e) => setTextureOffsetU(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {textureOffsetU.toFixed(2)}
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Position verticale</span>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={textureOffsetV}
                      onChange={(e) => setTextureOffsetV(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {textureOffsetV.toFixed(2)}
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Couleur des marques</span>
                    <input
                      type="color"
                      value={textureMarkColor}
                      onChange={(e) => setTextureMarkColor(e.target.value)}
                    />
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Intensité des marques</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={textureMarkStrength}
                      onChange={(e) =>
                        setTextureMarkStrength(Number(e.target.value))
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {Math.round(textureMarkStrength * 100)}
                      %
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Visibilité texture</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={textureStrength}
                      onChange={(e) =>
                        setTextureStrength(Number(e.target.value))
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {Math.round(textureStrength * 100)}%
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Flou texture</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={textureBlur}
                      onChange={(e) => setTextureBlur(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {Math.round(textureBlur * 100)}%
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Écailles</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={scalesStrength}
                      onChange={(e) =>
                        setScalesStrength(Number(e.target.value))
                      }
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 48, textAlign: "right" }}>
                      {Math.round(scalesStrength * 100)}%
                    </span>
                  </div>
                </>
            </section>
          )}

          {/* Onglet Couleurs */}
          {activeToolTab === "colors" && (
            <section className="panel">
              <h2 className="panel-title">Couleurs</h2>
              {(modelType === "LurePret5" ||
                modelType === "Shad" ||
                modelType === "Shad2" ||
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
                modelType === "Lure29") ? (
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
                      onChange={(e) => setGradientStrength2(Number(e.target.value))}
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
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Angle dégradé</span>
                    <div className="home-type-filters" style={{ flex: 1 }}>
                      {[0, 45, 90].map((ang) => (
                        <button
                          key={ang}
                          type="button"
                          className={`home-type-filter-btn${
                            gradientAngle === ang
                              ? " home-type-filter-btn--active"
                              : ""
                          }`}
                          onClick={() => setGradientAngle(ang)}
                        >
                          {ang}°
                        </button>
                      ))}
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
            </section>
          )}

          {/* Onglet Yeux */}
          {activeToolTab === "eyes" && (
            <EyeControls
              eyeWhiteColor={eyeWhiteColor}
              setEyeWhiteColor={setEyeWhiteColor}
              eyeIrisColor={eyeIrisColor}
              setEyeIrisColor={setEyeIrisColor}
              eyeGlowColor={eyeGlowColor}
              setEyeGlowColor={setEyeGlowColor}
              eyeGlowStrength={eyeGlowStrength}
              setEyeGlowStrength={setEyeGlowStrength}
            />
          )}

          {/* Onglet Affichage / Axes */}
          {activeToolTab === "view" && (
            <section className="panel" style={{ marginTop: 12 }}>
              <h2 className="panel-title">Affichage</h2>
              <div className="color-picker-row">
                <span>Axes 3D (X/Y/Z)</span>
                <button
                  type="button"
                  className={`home-type-filter-btn${
                    showAxes ? " home-type-filter-btn--active" : ""
                  }`}
                  onClick={() => setShowAxes(!showAxes)}
                >
                  {showAxes ? "Masquer" : "Afficher"}
                </button>
              </div>
            </section>
          )}
        </form>
      </div>
    </aside>
  );
}
