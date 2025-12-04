import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

const PlasticGradientMaterial = shaderMaterial(
  // uniforms
  {
    colorA: new THREE.Color("#ff5500"), // haut
    colorB: new THREE.Color("#ffffff"), // milieu
    colorC: new THREE.Color("#00ffaa"), // bas
    glossiness: 0.85, // 0 = mat, 1 = très brillant
    specularStrength: 1.2,
    envStrength: 0.2,
    gradientSmoothness: 1.0, // 0 = séparation nette, 1 = dégradé large (haut/milieu)
    gradientCenter: 0.33, // 0 = bas, 1 = haut (position frontière haut/milieu)
    gradientSmoothness2: 1.0, // séparation milieu/bas
    gradientCenter2: 0.66, // position frontière milieu/bas
    heightMin: -0.5, // bornes pour normaliser la hauteur
    heightMax: 0.5,
    map: null, // texture de mask éventuellement
    lightDir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), // direction lumière
  },
  // vertex shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;
    varying float vHeight;

    void main() {
      vUv = uv;

      // normales en espace vue (pour l'éclairage)
      vNormal = normalize(normalMatrix * normal);

      // normales en espace monde (pour le gradient haut/bas du leurre)
      vWorldNormal = normalize(mat3(modelMatrix) * normal);

      // position monde pour le gradient basé sur la hauteur
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vHeight = worldPosition.y;

      // direction vers la caméra en espace vue
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);

      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // fragment shader
  `
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform vec3 colorC;
    uniform float glossiness;
    uniform float specularStrength;
    uniform float envStrength;
    uniform float gradientSmoothness;
    uniform float gradientCenter;
    uniform float gradientSmoothness2;
    uniform float gradientCenter2;
    uniform float heightMin;
    uniform float heightMax;
    uniform sampler2D map;
    uniform vec3 lightDir;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;
    varying float vHeight;

    void main() {
      // 0 = bas (ventre), 1 = haut (dos), basé sur la position verticale normalisée
      float h = (vHeight - heightMin) / max(heightMax - heightMin, 0.0001);
      h = clamp(h, 0.0, 1.0);

      // Première transition : bas (C) -> milieu (B)
      float edge2 = clamp(gradientCenter2, 0.0, 1.0);
      float s2 = clamp(gradientSmoothness2, 0.001, 1.0);
      float width2 = 0.5 * s2;
      float t2 = smoothstep(edge2 - width2, edge2 + width2, h);
      vec3 lowMid = mix(colorC, colorB, t2);

      // Deuxième transition : milieu (lowMid) -> haut (A)
      float edge1 = clamp(gradientCenter, 0.0, 1.0);
      float s1 = clamp(gradientSmoothness, 0.001, 1.0);
      float width1 = 0.5 * s1;
      float t1 = smoothstep(edge1 - width1, edge1 + width1, h);

      vec3 baseColor = mix(lowMid, colorA, t1);

      // --- éclairage simple ---
      vec3 N = normalize(vNormal);
      vec3 L = normalize(lightDir);
      vec3 V = normalize(vViewDir);
      vec3 H = normalize(L + V);

      float NdotL = max(dot(N, L), 0.0);
      // jamais complètement noir
      float diffuse = 0.25 + 0.75 * NdotL;

      // specular "plastic/metal"
      float shininess = mix(12.0, 80.0, glossiness);
      float spec = pow(max(dot(N, H), 0.0), shininess) * specularStrength;

      // petit fresnel pour liseré brillant sur les bords
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * envStrength;

      vec3 color =
        baseColor * diffuse      // lumière diffuse
        + spec * vec3(1.0)       // highlight blanc
        + fresnel * vec3(1.0);   // liseré clair

      // Appliquer la texture de mask si présente (par multiplication)
      // On applique une rotation de 90° de la texture autour du centre de l'UV.
      vec2 rotatedUv = vec2(1.0 - vUv.y, vUv.x);
      vec4 texColor = texture2D(map, rotatedUv);
      // Si la texture a un alpha ou une luminosité, l'utiliser comme masque
      float maskFactor = max(texColor.a, max(texColor.r, max(texColor.g, texColor.b)));
      if (maskFactor > 0.001) {
        color *= mix(vec3(1.0), texColor.rgb, maskFactor);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
);

extend({ PlasticGradientMaterial });

export { PlasticGradientMaterial };


