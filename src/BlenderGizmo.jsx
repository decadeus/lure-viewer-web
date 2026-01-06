import React from "react";
import { Line, Html } from "@react-three/drei";

/**
 * Petit gizmo d'orientation façon Blender, uniquement visuel.
 *
 * On garde la scène en Y-up (convention Three.js),
 * mais on affiche les lettres comme en Z-up Blender :
 *  - X : rouge, vers la droite
 *  - Y : vert, en profondeur
 *  - Z : bleu, vers le haut
 */
export function BlenderGizmo() {
  // Taille réduite pour bien rentrer dans la zone du GizmoHelper
  const axisLength = 0.55;

  return (
    <group>
      {/* Axe X (rouge, horizontal) */}
      <Line
        points={[
          [0, 0, 0],
          [axisLength, 0, 0],
        ]}
        color="#ef4444"
        lineWidth={2}
      />
      <Html
        position={[axisLength + 0.12, 0, 0]}
        center
        style={{
          fontSize: 11,
          color: "#ef4444",
          fontWeight: 600,
        }}
      >
        X
      </Html>

      {/* Axe Z (bleu, vertical vers le haut) → correspond à Y interne */}
      <Line
        points={[
          [0, 0, 0],
          [0, axisLength, 0],
        ]}
        color="#3b82f6"
        lineWidth={2}
      />
      <Html
        position={[0, axisLength + 0.12, 0]}
        center
        style={{
          fontSize: 11,
          color: "#3b82f6",
          fontWeight: 600,
        }}
      >
        Z
      </Html>

      {/* Axe Y (vert, profondeur) → correspond à Z interne
          IMPORTANT : on le dessine dans le Z négatif (vers la caméra du GizmoHelper)
          pour être sûr qu'il soit devant le plan de coupe et bien visible. */}
      <Line
        points={[
          [0, 0, 0],
          [0, 0, -axisLength],
        ]}
        color="#22c55e"
        lineWidth={2}
      />
      <Html
        position={[0, 0, -axisLength - 0.12]}
        center
        style={{
          fontSize: 11,
          color: "#22c55e",
          fontWeight: 600,
        }}
      >
        Y
      </Html>
    </group>
  );
}


