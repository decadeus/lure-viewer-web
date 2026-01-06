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
  attachSize,
  setAttachSize,
  attachColor,
  setAttachColor,
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
  bavetteOffset,
  setBavetteOffset,
  bavetteAngle,
  setBavetteAngle,
  attachOffset,
  setAttachOffset,
  attachRotation,
  setAttachRotation,
  worldPerCm,
  activeToolTab,
  setActiveToolTab,
  sizePresetsInch,
  selectedSizeInch,
  setSelectedSizeInch,
  bavetteOptions,
  showAxes,
  setShowAxes,
  visibleParts,
  setVisibleParts,
  error,
  creating,
  onSubmit,
  onLogout,
  hidden,
  selectedPart,
  onSelectPart,
}) {
  const [bodyMode, setBodyMode] = useState("texture"); // "texture" | "size" | "scales" | "colors"
  const wpCm = worldPerCm || 1;
  // Normaliser: "body" est traité comme "lure" pour simplifier l'UI
  const currentElementRaw = selectedPart || "lure";
  const currentElement = currentElementRaw === "body" ? "lure" : currentElementRaw;

  let effectiveTab = activeToolTab || "size";
  if (currentElement === "eyes") {
    effectiveTab = "eyes";
  } else if (currentElement === "bavette" && hasBavetteSocket) {
    effectiveTab = "bavette";
  } else if (currentElement === "attach") {
    effectiveTab = "attach";
  } else if (currentElement === "lure") {
    effectiveTab = "size";
  }

  const elementOptions = [
    { key: "lure", label: "Leurre" },
    hasBavetteSocket || bavetteType
      ? { key: "bavette", label: "Bavette" }
      : null,
    attachOffset ? { key: "attach", label: "Attach" } : null,
    { key: "eyes", label: "Yeux" },
  ].filter(Boolean);

  return (
    <aside className={`sidebar${hidden ? " sidebar--hidden" : ""}`}>
      {/* Liste des éléments du leurre */}
      <section className="panel" style={{ marginBottom: 8 }}>
        <h2 className="panel-title">Éléments du leurre</h2>
        <div className="home-type-filters">
          {elementOptions.map((elt) => {
            const isActive = currentElement === elt.key;
            const visible = visibleParts?.[elt.key] ?? true;
            // On peut masquer/afficher Leurre, Bavette, Attach et Yeux
            const canHide = ["lure", "bavette", "attach", "eyes"].includes(elt.key);
            return (
              <div key={elt.key} className="element-row">
                <button
                  type="button"
                  className={`home-type-filter-btn${
                    isActive ? " home-type-filter-btn--active" : ""
                  }`}
                  onClick={() => {
                    if (onSelectPart) onSelectPart(elt.key);
                    // Garder activeToolTab synchronisé pour la logique existante
                    if (elt.key === "lure") setActiveToolTab("size");
                    else if (elt.key === "triple") setActiveToolTab("triple");
                    else if (elt.key === "body") setActiveToolTab("textures");
                    else setActiveToolTab(elt.key);
                  }}
                >
                  {elt.label}
                </button>
                {canHide && (
                  <button
                    type="button"
                    className={`element-eye-btn${
                      visible ? " element-eye-btn--on" : " element-eye-btn--off"
                    }`}
                    onClick={() =>
                      setVisibleParts((prev) => ({
                        ...prev,
                        [elt.key]: !prev?.[elt.key],
                      }))
                    }
                    title={visible ? "Masquer cet élément" : "Afficher cet élément"}
                  >
                    {visible ? "👁" : "👁‍🗨"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="sidebar-main">
        {/* Contenu des réglages de l'élément sélectionné (ou de l'onglet courant) */}
        <form
          id="create-lure-form"
          onSubmit={onSubmit}
          className="sidebar-content"
        >
          {/* Onglet Bavette */}
          {effectiveTab === "bavette" && (
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
              {/* La position / rotation de la bavette est gérée dans la petite
                  fenêtre flottante, pas dans la colonne de droite. */}
            </section>
          )}

          {/* Onglet Attach : taille + (plus tard) autres réglages propres */}
          {effectiveTab === "attach" && attachOffset && (
            <section className="panel">
              <h2 className="panel-title">Attach (Terminal tackle)</h2>
              <div className="color-picker-row">
                <span>Taille</span>
                <div className="home-type-filters" style={{ flex: 1 }}>
                  {["#10", "#8", "#6", "#4", "#2"].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      className={`home-type-filter-btn${
                        attachSize === sz
                          ? " home-type-filter-btn--active"
                          : ""
                      }`}
                      onClick={() => setAttachSize(sz)}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
              <div className="color-picker-row" style={{ marginTop: 8 }}>
                <span>Couleur</span>
                <div className="home-type-filters" style={{ flex: 1 }}>
                  {[
                    { key: "black", label: "Noir" },
                    { key: "gold", label: "Dorée" },
                    { key: "grey", label: "Gris" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`home-type-filter-btn${
                        attachColor === opt.key
                          ? " home-type-filter-btn--active"
                          : ""
                      }`}
                      onClick={() => setAttachColor(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}


          {/* Réglages du leurre (taille + textures / écailles / couleurs) */}
          {effectiveTab === "size" && (
            <section className="panel">
              <h2 className="panel-title" style={{ marginBottom: 6 }}>
                Leurre
              </h2>
              <div className="body-layout">
                <div className="body-modes">
                  <div className="home-type-filters">
                    {[
                      { key: "texture", label: "Tx" },
                      { key: "size", label: "Sz" },
                      { key: "scales", label: "Éc" },
                      { key: "colors", label: "Col" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`home-type-filter-btn${
                          bodyMode === opt.key
                            ? " home-type-filter-btn--active"
                            : ""
                        }`}
                        onClick={() => setBodyMode(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="body-controls">
              {/* Mode Texture : choix / positionnement / marks */}
              {bodyMode === "texture" && (
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
                </>
              )}

              {/* Mode Taille du leurre */}
              {bodyMode === "size" && (
                <div className="color-picker-row" style={{ marginTop: 4 }}>
                  <span>Taille du leurre</span>
                  <div className="home-type-filters" style={{ flex: 1 }}>
                    {Array.isArray(sizePresetsInch) && sizePresetsInch.length > 0 ? (
                      sizePresetsInch.map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`home-type-filter-btn${
                            selectedSizeInch === val
                              ? " home-type-filter-btn--active"
                              : ""
                          }`}
                          onClick={() => setSelectedSizeInch(val)}
                        >
                          {val}"
                        </button>
                      ))
                    ) : (
                      (modelType === "LureDouble" ||
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
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Mode Écailles : force des écailles */}
              {bodyMode === "scales" && (
                <div className="color-picker-row">
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
              )}

              {/* Mode Couleurs : dégradé / couleur du corps (toujours actif) */}
              {bodyMode === "colors" && (
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
              )}
                </div>
              </div>
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
          {effectiveTab === "eyes" && (
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

          {/* Plus d'onglet Affichage : les axes restent visibles (sauf en mode aperçu) */}
        </form>
      </div>

      {/* Lien de documentation Blender désactivé car la page /doc a été supprimée */}
    </aside>
  );
}
