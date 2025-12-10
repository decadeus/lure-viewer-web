import React from "react";

export function LurePret5PaletteControls({
  frontTripleSize,
  setFrontTripleSize,
  backPaletteType,
  setBackPaletteType,
  backTripleSize,
  setBackTripleSize,
}) {
  const frontTripleOptions = [
    { key: null, label: "Aucun" },
    { key: "Triple_#1", label: "#1" },
    { key: "Triple_#2", label: "#2" },
    { key: "Triple_#4", label: "#4" },
    { key: "Triple_#6", label: "#6" },
  ];

  const backPaletteOptions = [
    { key: null, label: "Aucune" },
    { key: "Palette_H", label: "H" },
    { key: "Palette_M", label: "M" },
    { key: "Palette_L", label: "L" },
  ];

  const backTripleOptions = [
    { key: null, label: "Aucun" },
    { key: "Triple_#1", label: "#1" },
    { key: "Triple_#2", label: "#2" },
    { key: "Triple_#4", label: "#4" },
    { key: "Triple_#6", label: "#6" },
  ];

  return (
    <section className="panel">
      <h2 className="panel-title">Triple devant</h2>
      <div className="home-type-filters" style={{ marginBottom: 8 }}>
        {frontTripleOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`home-type-filter-btn${
              frontTripleSize === opt.key ? " home-type-filter-btn--active" : ""
            }`}
            onClick={() =>
              setFrontTripleSize((current) =>
                current === opt.key ? null : opt.key,
              )
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <h2 className="panel-title" style={{ marginTop: 12 }}>
        Arrière : palette ou triple
      </h2>

      <div className="home-type-filters" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Palette arrière</span>
        {backPaletteOptions.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`home-type-filter-btn${
              backPaletteType === opt.key ? " home-type-filter-btn--active" : ""
            }`}
            onClick={() => {
              setBackPaletteType((current) =>
                current === opt.key ? null : opt.key,
              );
              // Si on choisit une palette, on désactive le triple arrière
              if (opt.key) {
                setBackTripleSize(null);
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="home-type-filters">
        <span style={{ fontSize: 12, opacity: 0.8 }}>Triple arrière</span>
        {backTripleOptions.map((opt) => (
          <button
            key={opt.key ?? "none"}
            type="button"
            className={`home-type-filter-btn${
              backTripleSize === opt.key ? " home-type-filter-btn--active" : ""
            }`}
            onClick={() => {
              setBackTripleSize((current) =>
                current === opt.key ? null : opt.key,
              );
              // Si on choisit un triple, on désactive la palette arrière
              if (opt.key) {
                setBackPaletteType(null);
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}



