import React from "react";

export function EyeControls({
  eyeWhiteColor,
  setEyeWhiteColor,
  eyeIrisColor,
  setEyeIrisColor,
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
    </section>
  );
}




