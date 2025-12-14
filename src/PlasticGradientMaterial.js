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
    heightMin: -0.5, // bornes pour normaliser la coordonnée de gradient
    heightMax: 0.5,
    gradientDir: new THREE.Vector3(0, 1, 0), // direction du gradient en espace monde
    map: null, // texture de mask éventuellement
    mapRotation: 0.0, // rotation de la texture (radians)
    mapCenter: new THREE.Vector2(0.5, 0.5), // centre de rotation en UV
    mapScale: new THREE.Vector2(1.0, 1.0), // échelle U/V de la texture
    mapOffset: new THREE.Vector2(0.0, 0.0), // décalage U/V de la texture
    blurRadius: 0.0, // 0 = net, 1 = flou maximum
    textureStrength: 1.0, // 0 = texture invisible, 1 = pleine
    // Couleur / intensité des marques (zones sombres de la texture Pike)
    markColor: new THREE.Color("#000000"),
    markStrength: 1.0,
    scalesMap: null, // texture d'écailles optionnelle
    scalesStrength: 0.0, // 0 = pas d'écailles, 1 = écailles max
    lightDir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(), // direction lumière
  },
  // vertex shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldNormal;
    varying float vHeight;

    uniform vec3 gradientDir;

    void main() {
      vUv = uv;

      // normales en espace vue (pour l'éclairage)
      vNormal = normalize(normalMatrix * normal);

      // normales en espace monde (pour le gradient haut/bas du leurre)
      vWorldNormal = normalize(mat3(modelMatrix) * normal);

      // position monde pour le gradient
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      // Projeter la position sur la direction du gradient
      vHeight = dot(worldPosition.xyz, gradientDir);

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
    uniform vec3 gradientDir;
    uniform sampler2D map;
    uniform float mapRotation;
    uniform vec2 mapCenter;
    uniform vec2 mapScale;
    uniform vec2 mapOffset;
    uniform float blurRadius;
    uniform float textureStrength;
    uniform vec3 markColor;
    uniform float markStrength;
    uniform sampler2D scalesMap;
    uniform float scalesStrength;
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
      vec2 uvLocal = vUv;
      // Si une rotation est définie, on tourne les UV autour de mapCenter
      if (abs(mapRotation) > 0.0001) {
        vec2 centered = uvLocal - mapCenter;
        float c = cos(mapRotation);
        float s = sin(mapRotation);
        uvLocal = vec2(
          c * centered.x - s * centered.y,
          s * centered.x + c * centered.y
        ) + mapCenter;
      }

      // Appliquer l'échelle de texture (mapScale)
      vec2 centeredForScale = uvLocal - mapCenter;
      uvLocal = centeredForScale * mapScale + mapCenter;

      // Appliquer un éventuel décalage (mapOffset) pour "glisser" le motif
      uvLocal += mapOffset;

      // Échantillonnage de la texture, avec éventuel flou simple
      vec4 texCenter = texture2D(map, uvLocal);
      vec4 texColor = texCenter;

      // blurRadius est attendu dans [0,1] (slider).
      // On applique un flou 3x3 plus marqué pour que l'effet soit bien visible.
      if (blurRadius > 0.001) {
        float radius = mix(0.01, 0.06, clamp(blurRadius, 0.0, 1.0));
        vec2 offs[8];
        offs[0] = vec2( radius, 0.0);
        offs[1] = vec2(-radius, 0.0);
        offs[2] = vec2(0.0,  radius);
        offs[3] = vec2(0.0, -radius);
        offs[4] = vec2( radius,  radius);
        offs[5] = vec2(-radius,  radius);
        offs[6] = vec2( radius, -radius);
        offs[7] = vec2(-radius, -radius);

        vec4 accum = texCenter;
        for (int i = 0; i < 8; i++) {
          accum += texture2D(map, uvLocal + offs[i]);
        }
        vec4 blurred = accum / 9.0;
        float k = clamp(blurRadius, 0.0, 1.0);
        texColor = mix(texCenter, blurred, k);
      }
      // Utiliser la luminosité de la texture comme masque de "marques" sombres :
      // - fond blanc (#ffffff)  -> lum ~ 1.0  -> mask ~ 0 (aucun effet)
      // - marques noires (#000) -> lum ~ 0.0  -> mask ~ 1 (effet maximum)
      float lumTex = (texColor.r + texColor.g + texColor.b) / 3.0;
      float kTex = clamp(textureStrength, 0.0, 1.0);
      float darkness = 1.0 - lumTex;
      // Seuil ~0.6 : en dessous, on considère que c'est encore du fond.
      float maskMarks = smoothstep(0.6, 1.0, darkness) * kTex;
      float kMark = clamp(markStrength, 0.0, 1.0);
      float markMix = maskMarks * kMark;
      if (markMix > 0.001) {
        // On garde les reflets et le volume du leurre, mais on teinte la zone
        // sombre vers la couleur des marques choisie par l'utilisateur.
        vec3 markTarget = mix(color, markColor, 0.7);
        color = mix(color, markTarget, markMix);
      }

      // Écailles : on applique une deuxième texture en niveaux de gris qui assombrit la couleur
      // pour donner une impression d'écailles noires / couleur du leurre.
      float kScales = clamp(scalesStrength, 0.0, 1.0);
      if (kScales > 0.001) {
        // On réduit la taille apparente des écailles en multipliant les UV par 3
        vec2 scalesUv = uvLocal * 3.0;
        // Rotation de 90° des écailles pour changer leur orientation
        scalesUv = vec2(-scalesUv.y, scalesUv.x);
        vec4 sTex = texture2D(scalesMap, scalesUv);
        float lum = (sTex.r + sTex.g + sTex.b) / 3.0; // 0 = noir, 1 = blanc
        float sMask = (1.0 - lum) * kScales; // 0 sur fond blanc, 1 sur zones foncées
        if (sMask > 0.001) {
          // On tire la couleur du gradient vers le noir dans les zones d'écailles.
          color = mix(color, vec3(0.0), clamp(sMask, 0.0, 1.0));
        }
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
);

extend({ PlasticGradientMaterial });

export { PlasticGradientMaterial };


