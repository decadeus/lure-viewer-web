import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

const GradientMaterial = shaderMaterial(
  // uniforms par défaut
  {
    colorA: new THREE.Color("#ff5500"), // couleur haut
    colorB: new THREE.Color("#00ffaa"), // couleur bas
    gradientSmoothness: 1.0, // 0 = coupure nette, 1 = dégradé complet
    gradientCenter: 0.5, // 0 = tout en bas, 1 = tout en haut
  },
  // vertex shader : on passe la position verticale
  `
    varying float vY;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vY = worldPosition.y;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  // fragment shader : dégradé du bas vers le haut selon vY
  `
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform float gradientSmoothness;
    uniform float gradientCenter;
    varying float vY;

    void main() {
      // on suppose vY dans un intervalle raisonnable autour de 0,
      // qu'on remappe en [0,1]
      float h = clamp(vY * 0.5 + 0.5, 0.0, 1.0);

      // centre de la séparation entre les deux couleurs (0 = bas, 1 = haut)
      float edge = clamp(gradientCenter, 0.0, 1.0);

      // 0 -> coupure nette (step), 1 -> smoothstep sur toute la hauteur
      float f;
      if (gradientSmoothness <= 0.001) {
        f = step(edge, h);
      } else {
        float width = 0.5 * gradientSmoothness;
        f = smoothstep(edge - width, edge + width, h);
      }

      // Couleur de base du dégradé
      vec3 baseColor = mix(colorB, colorA, f);

      // Effet pseudo-métallique simple : bande brillante autour du centre
      float band = 1.0 - abs(h - edge) * 2.0; // [-1,1] autour du edge
      band = clamp(band, 0.0, 1.0);
      float highlight = pow(band, 2.5); // encore plus large

      // Ajout d'un "rim" très marqué pour simuler un reflet fort
      float rim = pow(1.0 - band, 1.8);

      vec3 finalColor =
        baseColor * (0.4 + 0.6 * highlight) +
        vec3(0.45) * highlight +
        vec3(0.18) * rim;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
);

// on enregistre le matériau comme un composant <gradientMaterial />
extend({ GradientMaterial });

export { GradientMaterial };


