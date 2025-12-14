import React from "react";

export function EyeControls({
  eyeWhiteColor,
  setEyeWhiteColor,
  eyeIrisColor,
  setEyeIrisColor,
  eyeGlowColor,
  setEyeGlowColor,
  eyeGlowStrength,
  setEyeGlowStrength,
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">Yeux</h2>
      <div className="color-picker-row">
        <span>Blanc de l&apos;œil</span>
        <input
          type="color"
          value={eyeWhiteColor}
          onChange={(e) => setEyeWhiteColor(e.target.value)}
        />
      </div>
      <div className="color-picker-row" style={{ marginTop: 8 }}>
        <span>Iris</span>
        <input
          type="color"
          value={eyeIrisColor}
          onChange={(e) => setEyeIrisColor(e.target.value)}
        />
      </div>
      <div className="color-picker-row" style={{ marginTop: 8 }}>
        <span>Couleur halo</span>
        <input
          type="color"
          value={eyeGlowColor}
          onChange={(e) => setEyeGlowColor(e.target.value)}
        />
      </div>
      <div className="color-picker-row" style={{ marginTop: 8 }}>
        <span>Taille / intensité halo</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={eyeGlowStrength}
          onChange={(e) => setEyeGlowStrength(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ width: 48, textAlign: "right" }}>
          {Math.round(eyeGlowStrength * 100)}
          %
        </span>
      </div>
    </section>
  );
}




