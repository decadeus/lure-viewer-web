import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

const PlasticGradientMaterial = shaderMaterial(
  // uniforms
  {
    colorA: new THREE.Color("#ff5500"), // haut
    colorB: new THREE.Color("#00ffaa"), // bas
    glossiness: 0.85, // 0 = mat, 1 = très brillant
    specularStrength: 1.2,
    envStrength: 0.2,
    gradientSmoothness: 1.0, // 0 = séparation nette, 1 = dégradé large
    gradientCenter: 0.5, // 0 = bas, 1 = haut
    map: null, // texture de mask éventuellement
    lightDir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), // direction lumière
  },
  // vertex shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;

    void main() {
      vUv = uv;

      // normales en espace vue (pour l'éclairage)
      vNormal = normalize(normalMatrix * normal);

      // normales en espace monde (pour le gradient haut/bas du leurre)
      vWorldNormal = normalize(mat3(modelMatrix) * normal);

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
    uniform float glossiness;
    uniform float specularStrength;
    uniform float envStrength;
    uniform float gradientSmoothness;
    uniform float gradientCenter;
    uniform sampler2D map;
    uniform vec3 lightDir;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;

    void main() {
      // 0 en haut (dos), 1 en bas (ventre), basé sur la normale monde
      vec3 up = vec3(0.0, 1.0, 0.0);
      float nDotUp = dot(normalize(vWorldNormal), up); // 1 = dessus, -1 = dessous
      float h = clamp(0.5 * (1.0 - nDotUp), 0.0, 1.0); // 0 = haut, 1 = bas

      // contrôle de la position et de la douceur du dégradé
      float edge = clamp(gradientCenter, 0.0, 1.0);
      float s = clamp(gradientSmoothness, 0.001, 1.0);
      float width = 0.5 * s;
      float t = smoothstep(edge - width, edge + width, h);

      // --- base : gradient contrôlé ---
      vec3 baseColor = mix(colorB, colorA, t);

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
      vec4 texColor = texture2D(map, vUv);
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


