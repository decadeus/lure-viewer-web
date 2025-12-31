import React from "react";
import { Line, Html } from "@react-three/drei";

// Axes mondes avec petits traits de repère tous les 1 (unité physique : cm ou inch
// selon la conversion que lui envoie CreateLurePage).
// maxCm est automatiquement ajusté pour couvrir la longueur du leurre.
export function AxesWithTicks({ worldPerCm, lengthCm, paddingCm = 2, defaultMaxCm = 5 }) {
  if (!worldPerCm || !Number.isFinite(worldPerCm) || worldPerCm <= 0) {
    // Fallback : axes simples sans repères si on n'a pas la conversion
    return (
      <>
        <Line points={[[-5, 0, 0], [5, 0, 0]]} color="#ef4444" lineWidth={1} />
        <Line points={[[0, -5, 0], [0, 5, 0]]} color="#3b82f6" lineWidth={1} />
        <Line points={[[0, 0, -5], [0, 0, 5]]} color="#22c55e" lineWidth={1} />
      </>
    );
  }

  // Déterminer jusqu'où vont les axes en cm :
  // - on couvre au moins la moitié de la longueur du leurre + un padding,
  // - arrondi au multiple de 5 cm supérieur,
  // - sinon on retombe sur defaultMaxCm.
  let halfSpanCm = defaultMaxCm;
  if (lengthCm && Number.isFinite(lengthCm) && lengthCm > 0) {
    halfSpanCm = Math.max(
      defaultMaxCm,
      Math.ceil((lengthCm / 2 + paddingCm) / 5) * 5,
    );
  }

  const maxCm = halfSpanCm;
  const rangeWorld = maxCm * worldPerCm;
  const tickSize = 0.08; // taille des petits traits (1 cm)
  const majorTickSize = 0.14; // taille des traits tous les 5 cm

  const ticksX = [];
  const ticksY = [];
  const ticksZ = [];
  const majorTicksX = [];
  const majorTicksY = [];
  const majorTicksZ = [];

  for (let i = -maxCm; i <= maxCm; i += 1) {
    const offset = i * worldPerCm;
    // Axe X : traits perpendiculaires en Y
    ticksX.push([
      [offset, -tickSize, 0],
      [offset, tickSize, 0],
    ]);
    if (i !== 0 && i % 5 === 0) {
      majorTicksX.push({
        cm: i,
        seg: [
          [offset, -majorTickSize, 0],
          [offset, majorTickSize, 0],
        ],
      });
    }
    // Axe Y : traits perpendiculaires en X
    ticksY.push([
      [-tickSize, offset, 0],
      [tickSize, offset, 0],
    ]);
    if (i !== 0 && i % 5 === 0) {
      majorTicksY.push({
        cm: i,
        seg: [
          [-majorTickSize, offset, 0],
          [majorTickSize, offset, 0],
        ],
      });
    }
    // Axe Z : traits perpendiculaires en X
    ticksZ.push([
      [-tickSize, 0, offset],
      [tickSize, 0, offset],
    ]);
    if (i !== 0 && i % 5 === 0) {
      majorTicksZ.push({
        cm: i,
        seg: [
          [-majorTickSize, 0, offset],
          [majorTickSize, 0, offset],
        ],
      });
    }
  }

  return (
    <group>
      {/* Axes principaux */}
      <Line
        points={[
          [-rangeWorld, 0, 0],
          [rangeWorld, 0, 0],
        ]}
        color="#ef4444"
        lineWidth={1}
      />
      <Line
        points={[
          [0, -rangeWorld, 0],
          [0, rangeWorld, 0],
        ]}
        color="#3b82f6"
        lineWidth={1}
      />
      <Line
        points={[
          [0, 0, -rangeWorld],
          [0, 0, rangeWorld],
        ]}
        color="#22c55e"
        lineWidth={1}
      />

      {/* Traits de repère tous les 1 cm */}
      {ticksX.map((seg, idx) => (
        <Line key={`tx-${idx}`} points={seg} color="#ef4444" lineWidth={1} />
      ))}
      {ticksY.map((seg, idx) => (
        <Line key={`ty-${idx}`} points={seg} color="#3b82f6" lineWidth={1} />
      ))}
      {ticksZ.map((seg, idx) => (
        <Line key={`tz-${idx}`} points={seg} color="#22c55e" lineWidth={1} />
      ))}

      {/* Traits et labels tous les 5 cm (côté positif uniquement pour la lisibilité) */}
      {majorTicksX
        .filter((t) => t.cm > 0)
        .map((t) => (
          <group key={`mtx-${t.cm}`}>
            <Line points={t.seg} color="#ef4444" lineWidth={1.2} />
            <Html
              position={[t.seg[0][0], majorTickSize * 1.6, 0]}
              center
              style={{
                fontSize: 9,
                color: "#e5e7eb",
                whiteSpace: "nowrap",
              }}
            >
              {t.cm}
            </Html>
          </group>
        ))}

      {majorTicksY
        .filter((t) => t.cm > 0)
        .map((t) => (
          <group key={`mty-${t.cm}`}>
            <Line points={t.seg} color="#3b82f6" lineWidth={1.2} />
            <Html
              position={[majorTickSize * 1.8, t.seg[0][1], 0]}
              style={{
                fontSize: 9,
                color: "#e5e7eb",
                whiteSpace: "nowrap",
              }}
            >
              {t.cm}
            </Html>
          </group>
        ))}

      {majorTicksZ
        .filter((t) => t.cm > 0)
        .map((t) => (
          <group key={`mtz-${t.cm}`}>
            <Line points={t.seg} color="#22c55e" lineWidth={1.2} />
            <Html
              position={[majorTickSize * 1.8, 0, t.seg[0][2]]}
              style={{
                fontSize: 9,
                color: "#e5e7eb",
                whiteSpace: "nowrap",
              }}
            >
              {t.cm}
            </Html>
          </group>
        ))}
    </group>
  );
}


