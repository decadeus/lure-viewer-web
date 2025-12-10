import { useEffect, useState, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  useTexture,
  Html,
  GizmoHelper,
  GizmoViewport,
  Line,
} from "@react-three/drei";
import * as THREE from "three";
import "./App.css";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage.jsx";
import { GradientMaterial } from "./GradientMaterial";
import { PlasticGradientMaterial } from "./PlasticGradientMaterial";
import { attachTripleToLure } from "./tripleAttachment";
import { attachPaletteToLure } from "./paletteAttachment";
import { CreateLureSidebar } from "./CreateLureSidebar";

// ----------- Utilitaires modèle 3D -----------

function getModelPath(modelType) {
  switch (modelType) {
    case "LurePret5":
      return "/models/LurePret7.glb";
    default:
      // Fallback : tous les anciens modèles pointent maintenant sur LurePret7
      return "/models/LurePret7.glb";
  }
}

// Génère des UV simples pour le mesh UNIQUEMENT s'il n'en a pas déjà.
// (On ne veut surtout pas écraser les UV exportées depuis Blender, sauf cas particulier.)
function ensureGeometryUVs(geometry) {
  if (!geometry) return;
  if (geometry.attributes && geometry.attributes.uv) {
    // Déjà des UV -> on ne touche à rien.
    return;
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;

  const pos = geometry.attributes.position;
  if (!pos) return;

  const size = new THREE.Vector3();
  box.getSize(size);

  // Choisir les 2 axes les plus grands pour projeter la texture (meilleure répartition).
  const axes = [
    { key: "x", size: Math.abs(size.x) },
    { key: "y", size: Math.abs(size.y) },
    { key: "z", size: Math.abs(size.z) },
  ].sort((a, b) => b.size - a.size);

  const axisU = axes[0]?.key || "x";
  const axisV = axes[1]?.key || "z";

  const spanU =
    Math.abs(size[axisU]) > 1e-5 ? size[axisU] : 1;
  const spanV =
    Math.abs(size[axisV]) > 1e-5 ? size[axisV] : 1;

  const uv = new THREE.Float32BufferAttribute(pos.count * 2, 2);

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const coord = { x, y, z };

    const u = (coord[axisU] - box.min[axisU]) / spanU;
    const v = (coord[axisV] - box.min[axisV]) / spanV;

    uv.setXY(i, u, v);
  }

  geometry.setAttribute("uv", uv);
  geometry.attributes.uv.needsUpdate = true;
}

// Variante forcée : régénère les UV même si elles existent déjà.
// On ne l'utilise que pour des cas très ciblés (ex: LurePret5/Cube) où
// on veut surcharger l'UV Blender pour que la texture recouvre tout le corps.
function ensureGeometryUVsForce(geometry) {
  if (!geometry) return;
  // On supprime l'UV existante et on laisse ensureGeometryUVs en recréer une.
  if (geometry.attributes && geometry.attributes.uv) {
    geometry.deleteAttribute("uv");
  }
  ensureGeometryUVs(geometry);
}

function LureModel({
  modelType,
  color,
  useGradient = false,
  gradientTop = "#ff5500",
  gradientMiddle = "#ffffff",
  gradientBottom = "#00ffaa",
  gradientSmoothness = 1,
  gradientCenter = 0.5,
  gradientSmoothness2 = 1,
  gradientCenter2 = 0.66,
  gradientAngle = 0, // 0, 45, 90 (orientation du dégradé)
  gradientTargetName = null,
  runnerType = null,
  maskType = "none",
  collectionType = null, // "Palette" | "Hoo_B" | null
  textureUrl = null,
  textureRotation = 0, // en degrés
  textureScale = 1, // échelle U (densité) de la texture
  textureBlur = 0, // 0 = net, 1 = flou
  textureStrength = 1, // 0 = texture invisible, 1 = pleine
  scalesStrength = 0, // 0 = pas d'écailles, 1 = écailles fortes
  paletteType = null, // ex: "Palette_H", "Palette_M" (depuis Palettes.glb)
  tripleSize = null, // ex: "Triple_#1", "Triple_#2", "Triple_#4", "Triple_#6" (depuis N_Triple_Asset.glb)
  frontTripleSize = null, // pour LurePret5 : taille du triple à l'avant
  backTripleSize = null, // pour LurePret5 : taille du triple à l'arrière
  backPaletteType = null, // pour LurePret5 : Palette_H / M / L à l'arrière
  eyeWhiteColor = "#ffffff", // couleur de la partie "Blanc" de l'œil (sclère)
  eyeIrisColor = "#000000", // couleur de la partie "Iris" autour de l'œil
  lureSize = "M", // \"M\" (base), \"L\" (x1.25), \"XL\" (x1.5)
  onComputedDimensionsCm = null,
}) {
  const modelPath = getModelPath(modelType);
  const gltf = useGLTF(modelPath);
  const { scene } = gltf;
  // Charger une texture (même si on ne l'utilise pas toujours) pour respecter les règles des hooks.
  const colorTexture = useTexture(textureUrl || "/textures/Pike-002.png");
  const scalesTexture = useTexture("/textures/Scales_001.png");
  const hasTexture = !!textureUrl;
  // Fichier commun contenant toutes les palettes disponibles
  // (PalettesV5.glb avec points d'attache Palette_Attach_H/M/L)
  const palettesGltf = useGLTF("/Palettes/PalettesV5.glb");
  // Accessoire Triple (N_Triple_Asset.glb) pour certains leurres (plusieurs tailles)
  const tripleGltf = useGLTF("/Triple/N_Triple_Asset.glb");
  // Modèle de référence contenant le cube Taille_M pour la calibration des cm
  const referenceGltf = useGLTF("/models/LurePret8.glb");

  useEffect(() => {
    // DEBUG: vérifier que le bon modèle est bien utilisé
    // eslint-disable-next-line no-console
    console.log("LureModel debug", { modelType, modelPath });

    if (!scene) return;

    // Appliquer une éventuelle rotation de texture (agissant partout où colorTexture est utilisée),
    // et activer le RepeatWrapping pour que la texture puisse se répéter sur tout le corps.
    if (hasTexture && colorTexture) {
      const rotationRad = (textureRotation * Math.PI) / 180;
      colorTexture.center.set(0.5, 0.5);
      colorTexture.rotation = rotationRad;
      colorTexture.wrapS = THREE.RepeatWrapping;
      colorTexture.wrapT = THREE.RepeatWrapping;
      colorTexture.needsUpdate = true;
    }

    // Configurer également la texture d'écailles pour qu'elle puisse se répéter proprement.
    if (scalesTexture) {
      scalesTexture.wrapS = THREE.RepeatWrapping;
      scalesTexture.wrapT = THREE.RepeatWrapping;
      scalesTexture.needsUpdate = true;
    }

    // Pour LurePret5, on force un dépliage UV "propre" du corps (Cube) quand une texture est active,
    // pour que le motif recouvre tout le leurre indépendamment des UV Blender.
    if (modelType === "LurePret5" && hasTexture && scene) {
      const cube = scene.getObjectByName("Cube");
      if (cube && cube.geometry) {
        ensureGeometryUVsForce(cube.geometry);
      }
    }

    // DEBUG palettes : une fois par chargement, lister tous les noms de PalettesV4.glb
    if (palettesGltf?.scene && !palettesGltf.scene.userData.loggedNames) {
      const names = [];
      palettesGltf.scene.traverse((child) => {
        if (child.name) names.push(child.name);
      });
      // eslint-disable-next-line no-console
      console.log("PalettesV4 nodes:", names);
      palettesGltf.scene.userData.loggedNames = true;
    }

    // DEBUG (désactivé) : affichage des textures GLTF
    // if (gltf.textures && gltf.textures.length) {
    //   // eslint-disable-next-line no-console
    //   console.warn(
    //     "GLTF textures for",
    //     modelType,
    //     (gltf.textures || []).map((t) => t.name || (t.image && t.image.name)),
    //   );
    // }

    // 1) Calibration unités 3D -> centimètres via le cube Taille_M
    if (!scene.userData.cmPerWorldUnit && referenceGltf?.scene) {
      const refCube = referenceGltf.scene.getObjectByName("Taille_M");
      if (refCube) {
        const refBox = new THREE.Box3().setFromObject(refCube);
        const refSize = refBox.getSize(new THREE.Vector3());
        const refLengthUnits = Math.abs(refSize.x) || 1;
        const refLengthCm = 4.0; // Taille_M correspond à ~4 cm réels (40 cm / x10)
        scene.userData.cmPerWorldUnit = refLengthCm / refLengthUnits;
      }
    }

    // 2) Normalisation du modèle (position/échelle) pour l'affichage
    if (!scene.userData.normalized) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      // Mémoriser les dimensions brutes du leurre avant normalisation (en unités 3D)
      scene.userData.baseSizeWorld = size.clone();

      scene.position.sub(center);
      const scaleFactor = 1.5 / maxDim;
      scene.scale.setScalar(scaleFactor);

      // stocker les bornes verticales normalisées pour le shader de dégradé
      const normalizedBox = new THREE.Box3().setFromObject(scene);
      scene.userData.gradientHeightMin = normalizedBox.min.y;
      scene.userData.gradientHeightMax = normalizedBox.max.y;

      scene.userData.normalized = true;
      scene.userData.currentSizeScale = 1;

      // Conversion finale unités monde -> cm pour les axes après normalisation :
      // worldPerCm = scaleFactor / cmPerWorldUnit
      if (scene.userData.cmPerWorldUnit) {
        scene.userData.worldPerCm = scaleFactor / scene.userData.cmPerWorldUnit;
      }
    }

    // Ajuster la taille globale du leurre sans modifier la taille apparente
    // des accessoires (triples / palettes) : on appliquera l'inverse lors
    // de l'attache dans `attachTripleToLure` / `attachPaletteToLure`.
    const sizeScale =
      lureSize === "XL" ? 1.5 : lureSize === "L" ? 1.25 : 1.0;
    if (scene.userData.currentSizeScale !== sizeScale) {
      const fromScale = scene.userData.currentSizeScale || 1;
      const factor = sizeScale / fromScale;
      scene.scale.multiplyScalar(factor);
      scene.userData.currentSizeScale = sizeScale;
    }

    // 3) Calcul des dimensions réelles approximatives du leurre en cm
    if (scene.userData.cmPerWorldUnit && scene.userData.baseSizeWorld) {
      const cmPerWorldUnit = scene.userData.cmPerWorldUnit;
      const baseSizeCm = scene.userData.baseSizeWorld
        .clone()
        .multiplyScalar(cmPerWorldUnit);
      const scaleFactorCurrent = scene.userData.currentSizeScale || 1;
      const lengthCm = baseSizeCm.x * scaleFactorCurrent;
      const heightCm = baseSizeCm.y * scaleFactorCurrent;
      const widthCm = baseSizeCm.z * scaleFactorCurrent;
      const worldPerCm = scene.userData.worldPerCm || 1 / cmPerWorldUnit;

      if (typeof onComputedDimensionsCm === "function") {
        onComputedDimensionsCm({
          lengthCm,
          heightCm,
          widthCm,
          worldPerCm,
        });
      }
    }

  // Pour certains modèles (LurePret5), on force un
    // recalcul des normales côté Three.js pour éviter l'effet "facettes"
    // même si le GLB n'a pas été exporté avec le bon lissage.
    if (modelType === "LurePret5") {
      scene.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;
        // Recalculer des normales lissées
        if (child.geometry && child.geometry.computeVertexNormals) {
          child.geometry.computeVertexNormals();
        }
        // S'assurer que le matériau n'est pas en flat shading
        if (child.material) {
          child.material.flatShading = false;
          child.material.needsUpdate = true;
        }
      });
    }

    // DEBUG: loguer une fois la liste des meshes et matériaux du modèle
    if (!scene.userData.loggedMeshes) {
      const meshInfos = [];
      scene.traverse((child) => {
        if (child.isMesh) {
          meshInfos.push({
            name: child.name,
            materialName: child.material?.name || null,
          });
        }
      });
      // eslint-disable-next-line no-console
      console.log("LureModel meshes", {
        modelType,
        maskType,
        meshes: meshInfos,
      });
      scene.userData.loggedMeshes = true;
    }

    // Gérer les yeux (Blanc / Iris) avec des couleurs personnalisables
    const eyeWhite = new THREE.Color(eyeWhiteColor || "#ffffff");
    const eyeIris = new THREE.Color(eyeIrisColor || "#000000");

    scene.traverse((child) => {
      if (!child.isMesh || !child.material || !child.material.color) return;

      const rawName = child.name || "";
      const rawMatName = child.material.name || "";
      const name = rawName.toLowerCase();
      const matName = rawMatName.toLowerCase();

      // Détection assez large des parties d'œil :
      // - anciens noms : Oeil_Droit / Oeil_Gauche
      // - nouveaux éléments : "Blanc..." et "Iris..." (objets ou matériaux)
      const isEyeMesh =
        rawName === "Oeil_Droit" ||
        rawName === "Oeil_Gauche" ||
        name.includes("oeil") ||
        name.startsWith("blanc") ||
        name.includes("iris") ||
        matName.includes("oeil") ||
        matName.startsWith("blanc") ||
        matName.includes("iris");

      if (!isEyeMesh) return;

      const isWhitePart =
        rawName.startsWith("Blanc") ||
        rawMatName.startsWith("Blanc") ||
        name.startsWith("blanc");

      const isIrisPart =
        name.includes("iris") || matName.includes("iris");

      if (isWhitePart) {
        child.material.color.copy(eyeWhite);
      } else if (isIrisPart) {
        child.material.color.copy(eyeIris);
      } else {
        // Fallback : si c'est un mesh d'œil mais qu'on ne sait pas si c'est Blanc/Iris,
        // on applique la couleur de l'iris.
        child.material.color.copy(eyeIris);
      }

      const mat = child.material;
      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.roughness = 0.05;
        mat.metalness = 0.9;
        mat.envMapIntensity = 2.5;
        if ("clearcoat" in mat) {
          mat.clearcoat = 1.0;
          mat.clearcoatRoughness = 0.05;
        }
      }
    });

    // Gestion des différents "runners" (Slallow / Medium / Deep)
    const runnerNames = ["SlallowRunner", "MediumRunner", "DeepRunner"];
    // Meshes de la palette métallique (voir log LureModel meshes pour Lure28)
    const paletteMeshNames = new Set([
      "Cube001",
      "Cylinder",
      "Cylinder001",
      "Torus006",
      "Torus007",
      "Torus008",
    ]);
    // Meshes du Hoo_B (utilisés pour le basculement de collection)
    const hooBMeshNames = new Set(["Torus002", "Torus004", "Triple001"]);
    if (runnerType && runnerNames.includes(runnerType)) {
      scene.traverse((child) => {
        if (child.isMesh && runnerNames.includes(child.name)) {
          // visibilité : un seul runner affiché à la fois
          child.visible = child.name === runnerType;

          if (child.material) {
            // S'assurer que chaque bavette a SON propre matériau,
            // pour ne pas partager la couleur avec le corps du leurre.
            if (!child.material.userData?.isRunnerMaterial) {
              const cloned = child.material.clone();
              cloned.userData = { ...(cloned.userData || {}), isRunnerMaterial: true };
              child.material = cloned;
            }

            // effet plastique blanc opaque (Option A)
            child.material.transparent = false;
            child.material.opacity = 1.0;
            if ("roughness" in child.material) {
              child.material.roughness = 0.2;
            }
            if ("metalness" in child.material) {
              child.material.metalness = 0.05;
            }
          }
        }
      });
    }

    // Gestion des collections spécifiques à Lure25/Lure26/Lure27/Lure28/Lure29 (Palette / Hoo_B)
    if (
      (modelType === "Lure25" ||
        modelType === "Lure26" ||
        modelType === "Lure27" ||
        modelType === "Lure28" ||
        modelType === "Lure29") &&
      collectionType
    ) {
      const collectionNames = ["Palette", "Hoo_B"];

      scene.traverse((child) => {
        // 1) Si on a des noeuds/groupes nommés "Palette" / "Hoo_B", on les bascule directement
        let current = child;
        let collection = null;
        while (current && !collection) {
          if (collectionNames.includes(current.name)) {
            collection = current.name;
            break;
          }
          current = current.parent;
        }

        if (collection) {
          child.visible = collection === collectionType;
          return;
        }

        // 2) Fallback par nom de mesh (cas Lure28 : les collections Blender ne sont pas exportées)
        if (!child.isMesh) return;

        const isPaletteMesh = paletteMeshNames.has(child.name);
        const isHooBMesh = hooBMeshNames.has(child.name);
        if (!isPaletteMesh && !isHooBMesh) return;

        if (collectionType === "Palette") {
          child.visible = isPaletteMesh;
        } else if (collectionType === "Hoo_B") {
          child.visible = isHooBMesh;
        }
      });
    }

    // Gestion des masks (Pike / Card) via la visibilité des meshes
    if (modelType === "Lure21" || modelType === "Lure22") {
      // Nouveau comportement spécifique à Lure21/Lure22 :
      // - le corps (Cube) reste toujours visible
      // - les meshes de mask sont activés/désactivés selon le bouton choisi
      scene.traverse((child) => {
        if (!child.isMesh) return;

        const rawName = child.name || "";
        const rawMatName = child.material?.name || "";
        const name = rawName.toLowerCase();
        const matName = rawMatName.toLowerCase();

        // Corps du leurre : mesh "Cube"
        if (rawName === "Cube") {
          child.visible = true;
          child.renderOrder = 0;
          return;
        }

        // Mesh de mask brochet : Cube_PikeMask / Mat_PikeMask
        const isPike =
          rawName === "Cube_PikeMask" ||
          name.includes("cube_pikemask") ||
          rawMatName === "Mat_PikeMask" ||
          matName.includes("mat_pikemask");

        // Mesh de mask points : Cube_CardMask / Mat_CardMask
        const isCard =
          rawName === "Cube_CardMask" ||
          name.includes("cube_cardmask") ||
          rawMatName === "Mat_CardMask" ||
          matName.includes("mat_cardmask");

        if (!isPike && !isCard) return;

        // S'assurer que les masks se dessinent au-dessus du corps
        if (child.material) {
          child.material.transparent = true;
          child.material.depthWrite = false;
          child.renderOrder = 1;
        }

        if (maskType === "none") {
          child.visible = false;
        } else if (maskType === "pike") {
          child.visible = isPike;
        } else if (maskType === "card") {
          child.visible = isCard;
        }
      });
    } else {
      // Comportement générique existant pour les autres modèles
      scene.traverse((child) => {
        if (!child.isMesh) return;
        const childName = child.name?.toLowerCase?.() || "";
        const matName = child.material?.name?.toLowerCase?.() || "";

        const isPike =
          childName.includes("pike") ||
          matName.includes("pike_mask") ||
          matName.includes("pike");
        const isCard =
          childName.includes("card") ||
          matName.includes("card_mask") ||
          matName.includes("modif_card") ||
          matName.includes("card");

        if (!isPike && !isCard) return;

        if (maskType === "none") {
          child.visible = false;
        } else if (maskType === "pike") {
          child.visible = isPike;
        } else if (maskType === "card") {
          child.visible = isCard;
        }
      });
    }

    // Si on utilise le matériau dégradé, on remplace/paramètre les matériaux du modèle
    if (useGradient) {
      const topColor = new THREE.Color(gradientTop);
      const midColor = new THREE.Color(gradientMiddle);
      const bottomColor = new THREE.Color(gradientBottom);
      // Déterminer la direction du gradient en fonction de l'angle choisi
      // 0°  : vertical (ventre -> dos)  => axe Y
      // 90° : le long du leurre (tête -> queue) => axe X
      // 45° : diagonale entre ces deux directions (X+Y)
      const gradientDir = new THREE.Vector3(0, 1, 0);
      if (gradientAngle === 90) {
        gradientDir.set(1, 0, 0);
      } else if (gradientAngle === 45) {
        gradientDir.set(1, 1, 0).normalize();
      }

      // Calculer min/max du gradient en projetant les 8 coins de la bounding box
      const box = new THREE.Box3().setFromObject(scene);
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      ];
      let heightMin = Infinity;
      let heightMax = -Infinity;
      corners.forEach((c) => {
        const proj = c.dot(gradientDir);
        if (proj < heightMin) heightMin = proj;
        if (proj > heightMax) heightMax = proj;
      });
      if (!Number.isFinite(heightMin) || !Number.isFinite(heightMax)) {
        heightMin = -0.75;
        heightMax = 0.75;
      }

      scene.traverse((child) => {
        if (child.isMesh) {
          if (gradientTargetName && child.name !== gradientTargetName) {
            return;
          }

          let material = child.material;

          // Utiliser le matériau plastique avec gradient pour le corps (Cube)
          if (!(material instanceof PlasticGradientMaterial)) {
            material = new PlasticGradientMaterial();
            child.material = material;
          }

          if (material.uniforms) {
            if (material.uniforms.colorA) {
              material.uniforms.colorA.value.copy(topColor);
            }
            if (material.uniforms.colorB) {
              material.uniforms.colorB.value.copy(midColor);
            }
            if (material.uniforms.colorC) {
              material.uniforms.colorC.value.copy(bottomColor);
            }
            // Degré de dégradé -> douceur du gradient (0 = coupure nette, 1 = très doux)
            if (material.uniforms.gradientSmoothness) {
              material.uniforms.gradientSmoothness.value = gradientSmoothness;
            }
            // Position du dégradé -> centre de la transition haut/bas
            if (material.uniforms.gradientCenter) {
              material.uniforms.gradientCenter.value = gradientCenter;
            }

            // Deuxième frontière (milieu/bas)
            if (material.uniforms.gradientSmoothness2) {
              material.uniforms.gradientSmoothness2.value = gradientSmoothness2;
            }
            if (material.uniforms.gradientCenter2) {
              material.uniforms.gradientCenter2.value = gradientCenter2;
            }

            if (material.uniforms.heightMin) {
              material.uniforms.heightMin.value = heightMin;
            }
            if (material.uniforms.heightMax) {
              material.uniforms.heightMax.value = heightMax;
            }
            if (material.uniforms.gradientDir) {
              material.uniforms.gradientDir.value.copy(gradientDir);
            }

            if (material.uniforms.glossiness) {
              material.uniforms.glossiness.value = 0.9;
            }
            if (material.uniforms.specularStrength) {
              material.uniforms.specularStrength.value = 1.4;
            }
            if (material.uniforms.envStrength) {
              material.uniforms.envStrength.value = 0.4;
            }

            // Appliquer éventuelle texture Pike (mask) + angle / échelle / flou
            if (material.uniforms.map) {
              material.uniforms.map.value = hasTexture ? colorTexture : null;
            }
            if (material.uniforms.mapRotation) {
              material.uniforms.mapRotation.value =
                (textureRotation * Math.PI) / 180;
            }
            if (material.uniforms.mapCenter) {
              material.uniforms.mapCenter.value.set(0.5, 0.5);
            }
            if (material.uniforms.mapScale) {
              const scaleU = Math.max(0.1, textureScale || 1);
              material.uniforms.mapScale.value.set(scaleU, 1.0);
            }
            if (material.uniforms.blurRadius) {
              material.uniforms.blurRadius.value = textureBlur;
            }
            if (material.uniforms.textureStrength) {
              material.uniforms.textureStrength.value = textureStrength;
            }
            if (material.uniforms.scalesMap) {
              material.uniforms.scalesMap.value =
                scalesStrength > 0 ? scalesTexture : null;
            }
            if (material.uniforms.scalesStrength) {
              material.uniforms.scalesStrength.value = scalesStrength;
            }
          }
        }
      });
      // Important : on ne fait PLUS de "return" ici.
      // On laisse la suite de l'effet s'exécuter pour gérer :
      // - les palettes / triples
      // - les textures "classiques" sur d'autres meshes
      // tout en évitant de modifier les meshes qui utilisent déjà PlasticGradientMaterial.
    }

    // Pour certains modèles, on conserve les couleurs / matériaux d'origine
    if (
      modelType === "Lure8" ||
      modelType === "Lure10" ||
      modelType === "Lure11" ||
      modelType === "Lure12" ||
      modelType === "Lure13" ||
      modelType === "Lure14" ||
      modelType === "Lure15" ||
      modelType === "Lure16" ||
      modelType === "Lure17" ||
      modelType === "Lure18" ||
      modelType === "Lure19"
    ) {
      return;
    }

    const targetColor = new THREE.Color(color);
    const isPaletteLure =
      modelType === "Lure25" ||
      modelType === "Lure26" ||
      modelType === "Lure27" ||
      modelType === "Lure28" ||
      modelType === "Lure29";
    scene.traverse((child) => {
      if (child.isMesh && child.material && child.material.color) {
        // Si le mesh utilise déjà le matériau de gradient plastique,
        // on ne recolorise pas pour ne pas casser le shader de dégradé.
        if (useGradient && child.material instanceof PlasticGradientMaterial) {
          return;
        }
        const matName = child.material.name?.toLowerCase?.() || "";

        // Ne jamais toucher aux matériaux de mask (Pike / Card)
        if (
          matName.includes("pike_mask") ||
          matName.includes("modif_card") ||
          matName.includes("mat_pikemask") ||
          matName.includes("mat_cardmask")
        ) {
          return;
        }

        // Palette métallique : on conserve la couleur / le relief Blender,
        // mais on renforce l'aspect métal / reflet.
        if (paletteMeshNames.has(child.name)) {
          const mat = child.material;
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            // ne pas toucher à mat.color (couleur exportée)
            mat.metalness = 1.0;
            mat.roughness = 0.08;
            mat.envMapIntensity = 3.5;
            if ("clearcoat" in mat) {
              mat.clearcoat = 1.0;
              mat.clearcoatRoughness = 0.04;
            }
          }
          return;
        }

        // Hoo_B (Torus / Triple) : gris foncé fixe, légèrement métallique
        if (hooBMeshNames.has(child.name)) {
          const mat = child.material;
          child.material.color.set("#333333");
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.roughness = 0.3;
            mat.metalness = 0.6;
            mat.envMapIntensity = 1.5;
          }
          return;
        }

        // Bavettes / palettes: toujours plastique blanc opaque
        if (runnerNames.includes(child.name)) {
          child.material.color.set("#ffffff");
          child.material.transparent = false;
          child.material.opacity = 1.0;
          const mat = child.material;
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.roughness = 0.22;
            mat.metalness = 0.05;
            mat.envMapIntensity = 1.2;
          }
          return;
        }

        // Pour les modèles à palette (Lure25-29), seul le corps "Cube" prend la couleur.
        // Les anneaux, émerillons, crochets, etc. gardent leur matériau Blender.
        if (
          (modelType === "Lure25" ||
            modelType === "Lure26" ||
            modelType === "Lure27" ||
            modelType === "Lure28" ||
            modelType === "Lure29") &&
          child.name !== "Cube"
        ) {
          return;
        }

        // Ne pas recolorer les yeux (ils sont gérés séparément : Blanc / Iris)
        const rawChildName = child.name || "";
        const rawChildMatName = child.material.name || "";
        const childNameLower = rawChildName.toLowerCase();
        const childMatNameLower = rawChildMatName.toLowerCase();

        const isEyeMeshGlobal =
          rawChildName === "Oeil_Droit" ||
          rawChildName === "Oeil_Gauche" ||
          childNameLower.includes("oeil") ||
          childNameLower.startsWith("blanc") ||
          childNameLower.includes("iris") ||
          childMatNameLower.includes("oeil") ||
          childMatNameLower.startsWith("blanc") ||
          childMatNameLower.includes("iris");

        if (isEyeMeshGlobal) {
          return;
        }

        // Couleur de base du corps du leurre
        child.material.color.copy(targetColor);

        // S'assurer que le corps utilise un matériau PBR brillant
        let mat = child.material;
        if (
          !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) &&
          !mat.userData?.isConvertedToPhysical
        ) {
          const physical = new THREE.MeshPhysicalMaterial({
            color: mat.color.clone(),
            metalness: isPaletteLure ? 0.35 : 0.85,
            roughness: isPaletteLure ? 0.16 : 0.03,
            clearcoat: 1.0,
            clearcoatRoughness: isPaletteLure ? 0.06 : 0.02,
            envMapIntensity: isPaletteLure ? 1.8 : 3.0,
          });
          if (mat.map) physical.map = mat.map;
          if (mat.normalMap) physical.normalMap = mat.normalMap;
          physical.userData = { ...(mat.userData || {}), isConvertedToPhysical: true };
          child.material = physical;
          mat = physical;
        }

        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          if (hasTexture && colorTexture) {
            // Mode texture simple :
            // - la couleur de base du leurre vient de targetColor (déjà copiée dans child.material.color)
            // - la texture Pike a un fond clair, donc la map multiplie la couleur du leurre
            //   et les bandes plus sombres modulent la couleur.

            ensureGeometryUVs(child.geometry);
            mat.map = colorTexture;
            mat.transparent = false;
            mat.opacity = 1.0;
            if (mat.map) {
              mat.map.needsUpdate = true;
            }
            mat.needsUpdate = true;
          } else {
            // Mode sans texture : on nettoie bien la map pour éviter de garder la texture précédente
            if (mat.map) {
              mat.map = null;
              mat.needsUpdate = true;
            }

            if (isPaletteLure) {
              // Aspect plastique légèrement brillant, peu métallique
              mat.roughness = 0.28;
              mat.metalness = 0.18;
              mat.envMapIntensity = 1.1;
              if ("clearcoat" in mat) {
                mat.clearcoat = 0.9;
                mat.clearcoatRoughness = 0.12;
              }
            } else {
              // Aspect plus satiné : beaucoup moins métallique, davantage diffus
              mat.roughness = 0.3;
              mat.metalness = 0.35;
              mat.envMapIntensity = 1.4;
              if ("clearcoat" in mat) {
                mat.clearcoat = 0.85;
                mat.clearcoatRoughness = 0.16;
              }
            }
          }
        }
      }
    });
    // Attache dynamique des palettes externes (PalettesV5.glb)
    // - paletteType : palettes "générales" (avant, socket PaletteSocket_Front)
    // - backPaletteType : palettes arrière spécifiques à LurePret5 (socket Attach_Back_Add)
    if (scene) {
      attachPaletteToLure({
        scene,
        palettesGltf,
        paletteName: paletteType,
          socketName: "PaletteSocket_Front",
          lureScale: sizeScale,
      });

      if (modelType === "LurePret5") {
        attachPaletteToLure({
          scene,
          palettesGltf,
          paletteName: backPaletteType,
          socketName: "Attach_Back_Add",
          lureScale: sizeScale,
        });
      }
    }

    // Attache dynamique du Triple (N_Triple_Asset.glb) via les repères.
    if (modelType === "LurePret5") {
      // Nettoyer les éventuels triples présents sur les deux points d'attache
      ["Attach_Down_add", "Attach_Back_Add"].forEach((name) => {
        const sock = scene.getObjectByName(name);
        if (sock) {
          sock.children
            .slice()
            .forEach((child) => {
              if (child.userData?.isAttachedTriple) {
                sock.remove(child);
              }
            });
        }
      });

      if (frontTripleSize) {
        attachTripleToLure({
          scene,
          tripleGltf,
          tripleSize: frontTripleSize,
          socketName: "Attach_Down_add",
          lureScale: sizeScale,
        });
      }
      // À l'arrière, on choisit soit un triple, soit une palette (backPaletteType)
      if (backTripleSize && !backPaletteType) {
        attachTripleToLure({
          scene,
          tripleGltf,
          tripleSize: backTripleSize,
          socketName: "Attach_Back_Add",
          lureScale: sizeScale,
        });
      }
    }
  }, [
    scene,
    color,
    modelType,
    useGradient,
    gradientTop,
    gradientMiddle,
    gradientBottom,
    gradientSmoothness,
    gradientCenter,
    gradientSmoothness2,
    gradientCenter2,
    gradientAngle,
    gradientTargetName,
    runnerType,
    maskType,
    collectionType,
    colorTexture,
    hasTexture,
    textureRotation,
    textureScale,
    textureBlur,
    scalesStrength,
    scalesTexture,
    textureStrength,
    palettesGltf,
    paletteType,
    backPaletteType,
    tripleGltf,
    tripleSize,
    frontTripleSize,
    backTripleSize,
    eyeWhiteColor,
    eyeIrisColor,
    lureSize,
  ]);

  // DEBUG texture / matériaux : liste les meshes avec info UV / texture
  scene.traverse((child) => {
    if (child.isMesh) {
      // eslint-disable-next-line no-console
      console.log("LureModel mesh debug", child.name, {
        hasUV: !!child.geometry?.attributes?.uv,
        hasMap: !!child.material?.map,
        materialType: child.material?.type,
      });
    }
  });

  return <primitive object={scene} />;
}

// Axes mondes avec petits traits de repère tous les 1 cm (approximatif),
// en utilisant la conversion unités 3D -> cm calculée via Taille_M.
// maxCm est automatiquement ajusté pour couvrir la longueur du leurre.
function AxesWithTicks({ worldPerCm, lengthCm, paddingCm = 2, defaultMaxCm = 10 }) {
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


// (les anciens helpers de règles 2D ont été retirés pour simplifier l'affichage)

// Règles 3D calibrées en cm pour LurePret5
function Rulers3D({ modelType }) {
  // On ne dessine les règles calibrées que pour LurePret5,
  // celui pour lequel on connaît la longueur réelle.
  if (modelType !== "LurePret5") return null;

  // Après normalisation, la plus grande dimension du leurre vaut 1.5 unités monde.
  // On sait que cela correspond à ~4.1 cm en réalité (taille M).
  const cmPerWorldUnit = 4.1 / 1.5;
  const worldPerCm = 1 / cmPerWorldUnit;

  // Longueur des règles (en cm)
  const horizontalLengthCm = 20; // 0–20 cm
  const verticalLengthCm = 5; // 0–5 cm
  const horizontalLengthWorld = horizontalLengthCm * worldPerCm;
  const verticalLengthWorld = verticalLengthCm * worldPerCm;

  // Hypothèse: le leurre est centré en (0,0,0) et sa longueur totale
  // (pointe -> queue) vaut 1.5 unités monde après normalisation.
  // On place donc le "0 cm" de la règle horizontale à la pointe du leurre.
  const lureLengthWorld = 1.5;
  const lureNoseX = -lureLengthWorld / 2; // pointe = extrémité gauche

  // Décalage vertical léger au-dessus du leurre
  const z = 0;
  const horizontalY = 0.6 * worldPerCm;

  // Règle horizontale : de 0 à 20 cm, collée à la pointe
  const horizontalStartX = lureNoseX;
  const horizontalEndX = horizontalStartX + horizontalLengthWorld;

  const horizontalPoints = [
    [horizontalStartX, horizontalY, z],
    [horizontalEndX, horizontalY, z],
  ];

  // Règle verticale à gauche (au niveau de 0 cm)
  const verticalX = horizontalStartX;
  const verticalBaseYTop = horizontalY; // 0 cm au croisement avec l'horizontale
  const verticalPoints = [
    [verticalX, verticalBaseYTop, z],
    [verticalX, verticalBaseYTop - verticalLengthWorld, z],
  ];

  const horizontalTicks = [];
  for (let cm = 0; cm <= horizontalLengthCm; cm += 1) {
    const x = horizontalStartX + cm * worldPerCm;
    const isMajor = cm % 5 === 0;
    const h = (isMajor ? 0.3 : 0.18) * worldPerCm;
    horizontalTicks.push({ cm, x, h, isMajor });
  }

  const verticalTicks = [];
  for (let cm = 0; cm <= verticalLengthCm; cm += 1) {
    // 0 cm en haut (au niveau de l'horizontale), 5 cm en bas
    const y = verticalBaseYTop - cm * worldPerCm;
    const isMajor = cm % 1 === 0;
    const w = (isMajor ? 0.3 : 0.18) * worldPerCm;
    verticalTicks.push({ cm, y, w, isMajor });
  }

  return (
    <group>
      {/* Règle horizontale */}
      <Line points={horizontalPoints} color="#e5e7eb" lineWidth={1} />
      {horizontalTicks.map((t) => (
        <group key={`h-${t.cm}`}>
          <Line
            points={[
              [t.x, horizontalY, z],
              [t.x, horizontalY + t.h, z],
            ]}
            color="#e5e7eb"
            lineWidth={1}
          />
          {t.isMajor && (
            <Html
              position={[t.x, horizontalY + t.h + 0.12 * worldPerCm, z]}
              center
              style={{
                fontSize: 10,
                color: "#e5e7eb",
                whiteSpace: "nowrap",
              }}
            >
              {t.cm}
              {t.cm === horizontalLengthCm ? " cm" : ""}
            </Html>
          )}
        </group>
      ))}

      {/* Règle verticale */}
      <Line points={verticalPoints} color="#e5e7eb" lineWidth={1} />
      {verticalTicks.map((t) => (
        <group key={`v-${t.cm}`}>
          <Line
            points={[
              [verticalX, t.y, z],
              [verticalX + t.w, t.y, z],
            ]}
            color="#e5e7eb"
            lineWidth={1}
          />
          <Html
            position={[verticalX + t.w + 0.12 * worldPerCm, t.y, z]}
            style={{
              fontSize: 10,
              color: "#e5e7eb",
              whiteSpace: "nowrap",
            }}
          >
            {t.cm}
            {t.cm === verticalLengthCm ? " cm" : ""}
          </Html>
        </group>
      ))}
    </group>
  );
}

useGLTF.preload("/models/Lure26.glb");
useGLTF.preload("/models/Lure27.glb");
useGLTF.preload("/models/Lure28.glb");
useGLTF.preload("/models/Lure29.glb");
useGLTF.preload("/models/LurePret7.glb");
useGLTF.preload("/models/CollectionTest.glb");
useGLTF.preload("/Palettes/PalettesV5.glb");
useGLTF.preload("/Triple/N_Triple_Asset.glb");

// ----------- Page principale : liste de cartes de leurres -----------

function HomePage() {
  const { user, initializing } = useAuth();
  const [lures, setLures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [previewLure, setPreviewLure] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // "all" | "mine"
  const navigate = useNavigate();

  useEffect(() => {
    if (initializing) return;

    const loadLures = async () => {
      setLoading(true);
      setError("");

      const query = supabase
        .from("lures")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Erreur chargement lures", error);
        setError("Impossible de charger les leurres.");
        setLures([]);
      } else {
        setLures(data ?? []);
      }

      setLoading(false);
    };

    loadLures();
  }, [initializing, user]);

  const handleCreateLure = () => {
    setCreating(true);
    navigate("/new");
  };

  if (initializing) {
    return (
      <div className="home-root">
        <div className="full-page-center">
          <span>Chargement de la session...</span>
        </div>
      </div>
    );
  }

  const visibleLures =
    filterMode === "mine" && user
      ? lures.filter((lure) => lure.user_id === user.id)
      : lures;

  return (
    <div className="home-root">
      <header className="home-header">
        <div className="home-header-left">
          <h1 className="home-title">Mes leurres</h1>
          <p className="home-subtitle">
            Liste de tous les leurres créés. Clique sur une carte pour ouvrir le
            viewer et tester la couleur.
          </p>
        </div>
        <div className="home-header-right">
          {user ? (
            <div className="user-chip">
              <span className="user-email">{user.email}</span>
              <button
                type="button"
                className="user-logout-btn"
                onClick={() => supabase.auth.signOut()}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => navigate("/auth")}
            >
              Se connecter
            </button>
          )}
          <div className="home-header-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={handleCreateLure}
              disabled={creating}
            >
              {creating ? "Chargement..." : "Créer un leurre"}
            </button>
          </div>
        </div>
      </header>

      <main className="home-body">
        <aside className="home-sidebar">
          <button
            type="button"
            className={`sidebar-filter-btn${
              filterMode === "all" ? " sidebar-filter-btn--active" : ""
            }`}
            onClick={() => setFilterMode("all")}
          >
            Tous les leurres
          </button>
          {user && (
            <button
              type="button"
              className={`sidebar-filter-btn${
                filterMode === "mine" ? " sidebar-filter-btn--active" : ""
              }`}
              onClick={() => setFilterMode("mine")}
            >
              Mes leurres
            </button>
          )}
        </aside>

        <section className="home-main">
          <div className="home-grid">
            {loading && (
              <p className="lure-list-message">Chargement des leurres...</p>
            )}
            {!loading && error && (
              <p className="lure-list-message lure-list-message--error">
                {error}
              </p>
            )}
            {!loading && !error && visibleLures.length === 0 && (
              <p className="lure-list-message">
                Aucun leurre à afficher pour ce filtre.
              </p>
            )}

            {!loading &&
              !error &&
              visibleLures.map((lure) => (
                <button
                  key={lure.id}
                  type="button"
                  className="lure-card"
                  onClick={() => setPreviewLure(lure)}
                >
                  <div className="lure-card-thumb">
                    {lure.thumbnail_url ? (
                      <img
                        src={lure.thumbnail_url}
                        alt={lure.ide || "Thumbnail leurre"}
                        className="lure-card-thumb-image"
                      />
                    ) : (
                      <div className="lure-card-thumb-fallback" />
                    )}
                  </div>
                  <div className="lure-card-body">
                    <div className="lure-card-header">
                      <h2>{lure.ide || "Leurre sans nom"}</h2>
                      <span className="lure-created-at">
                        {lure.created_at
                          ? new Date(lure.created_at).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div className="lure-card-info">
                      <span className="lure-meta-item">
                        Modèle : {lure.model_type || "inconnu"}
                      </span>
                      <span className="lure-color-label">
                        Couleur : {lure.color || "-"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      </main>
      {previewLure && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewLure(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {previewLure.ide || "Leurre"} (
                  {previewLure.model_type || "modèle inconnu"})
                </h2>
                <p className="modal-subtitle">
                  Aperçu 3D (lecture seule). Fais tourner le leurre avec la
                  souris.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewLure(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-viewer">
              <Canvas
                className="modal-canvas"
                camera={{ position: [0, 0.5, 2.5], fov: 50 }}
              >
                <ambientLight intensity={0.35} />
                <directionalLight position={[2, 5, 3]} intensity={1.6} />
                <directionalLight position={[-2, -3, -2]} intensity={0.8} />
                <pointLight position={[0, 2, 2]} intensity={0.7} />
                <Environment preset="sunset" />
                <LureModel
                  modelType={previewLure.model_type}
                  color={previewLure.color || "#ffffff"}
                  // Pour l'instant, on n'a pas encore de sauvegarde du type de triple,
                  // donc on utilise la valeur par défaut définie dans LureModel.
                />
                <OrbitControls
                  enablePan={false}
                  enableZoom
                  target={[0, 0, 0]}
                />
              </Canvas>
            </div>

            <div className="modal-actions">
              <span className="modal-hint">
                Clique et fais glisser pour tourner, molette pour zoomer. Cette
                popup sert uniquement à visualiser le leurre.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------- Page viewer : gauche 3D, droite sélection + couleur -----------

// NOTE: ViewerPage n'est plus utilisé dans ta navigation actuelle,
// on peut le remettre plus tard si nécessaire.

// ----------- Page création : choisir le type de leurre -----------

function CreateLurePage() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [modelType, setModelType] = useState("LurePret5");
  const [color, setColor] = useState("#ff0000");
  const [gradientTop, setGradientTop] = useState("#ff5500");
  const [gradientMiddle, setGradientMiddle] = useState("#ffffff");
  const [gradientBottom, setGradientBottom] = useState("#00ffaa");
  const [gradientStrength, setGradientStrength] = useState(100); // 0-100 (haut/milieu)
  const [gradientPosition, setGradientPosition] = useState(33); // 0-100, 0=bas, 100=haut (frontière haut/milieu)
  const [gradientStrength2, setGradientStrength2] = useState(100); // 0-100 (milieu/bas)
  const [gradientPosition2, setGradientPosition2] = useState(66); // 0-100 (frontière milieu/bas)
  const [gradientAngle, setGradientAngle] = useState(0); // 0, 45, 90
  const [runnerType, setRunnerType] = useState("SlallowRunner");
  const [maskType, setMaskType] = useState("none"); // "none" | "pike" | "card"
  const [collectionType, setCollectionType] = useState("Palette"); // pour Lure25/26/27/28 : "Palette" | "Hoo_B"
  // Texture actuellement sélectionnée pour le corps du leurre (null = aucune)
  const [selectedTexture, setSelectedTexture] = useState(null); // ex: "/textures/Pike-002.png"
  const [textureRotation, setTextureRotation] = useState(0); // angle en degrés
  const [textureScale, setTextureScale] = useState(1); // échelle U (densité)
  const [textureBlur, setTextureBlur] = useState(0); // 0-1 (force du flou)
  const [textureStrength, setTextureStrength] = useState(1); // 0-1 (visibilité de la texture)
  const [scalesStrength, setScalesStrength] = useState(0); // 0-1 (intensité des écailles)
  const [paletteType, setPaletteType] = useState("Palette_H"); // palettes générales (avant)
  const [tripleSize, setTripleSize] = useState("Triple_#4"); // taille du triple à attacher (LurePret5 front/back)
  // Pour LurePret2 : tailles indépendantes pour l'attache avant / arrière.
  // null = aucun triple pour cette attache.
  const [frontTripleSize, setFrontTripleSize] = useState(null);
  const [backTripleSize, setBackTripleSize] = useState(null);
  const [backPaletteType, setBackPaletteType] = useState(null); // "Palette_H" | "Palette_M" | "Palette_L" | null
  const [eyeWhiteColor, setEyeWhiteColor] = useState("#ffffff");
  const [eyeIrisColor, setEyeIrisColor] = useState("#000000");
  const [lureSize, setLureSize] = useState("M"); // M (base), L, XL
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  // Colonne gauche "à la Figma"
  // - leftMainTab: "file" => leurs enregistrés, "assets" => bibliothèques (textures / modèles)
  // - assetsView: "root" => liste des bibliothèques, ou "textures" / "models" pour le détail
  const [leftMainTab, setLeftMainTab] = useState("file"); // "file" | "assets"
  const [assetsView, setAssetsView] = useState("root"); // "root" | "textures" | "models"
  const glRef = useRef(null);
  const [currentDimensionsCm, setCurrentDimensionsCm] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (creating) return;

    if (!user) {
      setError("Tu dois être connecté pour créer un leurre.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const payload = {
        color,
        model_type: modelType,
        view: 1,
        user_id: user.id,
      };

      const {
        data: newLure,
        error,
      } = await supabase
        .from("lures")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erreur création leurre", error);
        setError("Impossible de créer ce leurre.");
        return;
      }

      // Générer et uploader un thumbnail basé sur le Canvas
      if (glRef.current && newLure?.id) {
        try {
          const dataUrl = glRef.current.domElement.toDataURL("image/png");
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const filePath = `lures/${newLure.id}.png`;

          const { error: uploadError } = await supabase.storage
            .from("thumbnails")
            .upload(filePath, blob, {
              upsert: true,
              contentType: "image/png",
            });

          if (!uploadError) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("thumbnails").getPublicUrl(filePath);

            if (publicUrl) {
              await supabase
                .from("lures")
                .update({ thumbnail_url: publicUrl })
                .eq("id", newLure.id);
            }
          } else {
            console.error("Erreur upload thumbnail", uploadError);
          }
        } catch (thumbErr) {
          console.error("Erreur génération thumbnail", thumbErr);
        }
      }

      navigate("/");
    } finally {
      setCreating(false);
    }
  };

  if (initializing) {
    return (
      <div className="app-root app-root--dark">
        <div className="full-page-center">
          <span>Chargement de la session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root app-root--dark">
      <div className="editor-layout">
        {/* Colonne gauche "à la Figma" */}
        <aside className="editor-sidebar">
          <div className="editor-sidebar-header">
            <div className="editor-tabs">
              <button
                type="button"
                className={`editor-tab${
                  leftMainTab === "file" ? " editor-tab--active" : ""
                }`}
                onClick={() => {
                  setLeftMainTab("file");
                  setAssetsView("root");
                }}
              >
                File
              </button>
              <button
                type="button"
                className={`editor-tab${
                  leftMainTab === "assets" ? " editor-tab--active" : ""
                }`}
                onClick={() => {
                  setLeftMainTab("assets");
                  setAssetsView("root");
                }}
              >
                Assets
              </button>
            </div>
          </div>
          <div className="editor-sidebar-content">
            {leftMainTab === "file" && (
              <div>
                <h2 className="editor-sidebar-title">Mes leurres</h2>
                <p className="editor-sidebar-placeholder">
                  Ici, tu verras la liste de tes leurres sauvegardés (comme
                  l&apos;onglet &quot;File&quot; de Figma). On pourra y
                  afficher les projets locaux ou ceux venant de Supabase.
                </p>
              </div>
            )}

            {leftMainTab === "assets" && assetsView === "root" && (
              <div>
                <h2 className="editor-sidebar-title">Libraries</h2>
                <div className="assets-library-list">
                  <button
                    type="button"
                    className="assets-library-card"
                    onClick={() => setAssetsView("textures")}
                  >
                    <div className="assets-library-thumb assets-library-thumb--textures" />
                    <div className="assets-library-meta">
                      <span className="assets-library-name">Textures</span>
                      <span className="assets-library-count">
                        1 texture (Pike) pour commencer
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="assets-library-card"
                    onClick={() => setAssetsView("models")}
                  >
                    <div className="assets-library-thumb assets-library-thumb--models" />
                    <div className="assets-library-meta">
                      <span className="assets-library-name">
                        Modèles de leurres
                      </span>
                      <span className="assets-library-count">
                        Choisis la forme de ton leurre
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {leftMainTab === "assets" && assetsView === "textures" && (
              <div>
                <div className="assets-back-row">
                  <button
                    type="button"
                    className="assets-back-btn"
                    onClick={() => setAssetsView("root")}
                  >
                    ← Assets
                  </button>
                  <span className="assets-section-title">Textures</span>
                </div>
                <div className="texture-list">
                  {[
                    {
                      key: "/textures/Pike-002.png",
                      name: "Pike 1",
                    },
                    {
                      key: "/textures/Pike_003.png",
                      name: "Pike 2",
                    },
                  ].map((tex) => (
                    <button
                      key={tex.key}
                      type="button"
                      className={`texture-item${
                        selectedTexture === tex.key ? " texture-item--active" : ""
                      }`}
                      onClick={() =>
                        setSelectedTexture((current) =>
                          current === tex.key ? null : tex.key,
                        )
                      }
                    >
                      <div className="texture-thumb texture-thumb--pike" />
                      <div className="texture-meta">
                        <span className="texture-name">{tex.name}</span>
                        <span className="texture-tag">
                          {selectedTexture === tex.key
                            ? "Utilisée sur le leurre"
                            : "Cliquer pour appliquer"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="color-picker-row" style={{ marginTop: 12 }}>
                  <span>Angle texture</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={textureRotation}
                    onChange={(e) => setTextureRotation(Number(e.target.value))}
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
                  <span>Visibilité texture</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={textureStrength}
                    onChange={(e) =>
                      setTextureStrength(Number(e.target.value))
                    }
                    style={{ flex: 1 }}
                  />
                  <span style={{ width: 48, textAlign: "right" }}>
                    {Math.round(textureStrength * 100)}
                    %
                  </span>
                </div>
                <div className="color-picker-row" style={{ marginTop: 8 }}>
                  <span>Flou texture</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={textureBlur}
                    onChange={(e) => setTextureBlur(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ width: 48, textAlign: "right" }}>
                    {Math.round(textureBlur * 100)}
                    %
                  </span>
                </div>
                <div className="color-picker-row" style={{ marginTop: 8 }}>
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
                    {Math.round(scalesStrength * 100)}
                    %
                  </span>
                </div>
              </div>
            )}

            {leftMainTab === "assets" && assetsView === "models" && (
              <div>
                <div className="assets-back-row">
                  <button
                    type="button"
                    className="assets-back-btn"
                    onClick={() => setAssetsView("root")}
                  >
                    ← Assets
                  </button>
                  <span className="assets-section-title">Modèles</span>
                </div>
                <div className="model-list">
                  {["LurePret5"].map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        className={`model-item${
                          modelType === type ? " model-item--active" : ""
                        }`}
                        onClick={() => setModelType(type)}
                      >
                        <span className="model-name">{type}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="viewer-container">
          <Canvas
            className="three-canvas"
            camera={{ position: [0, 0.5, 2.5], fov: 50 }}
            gl={{ preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              glRef.current = gl;
            }}
          >
            <ambientLight intensity={0.3} />
            <directionalLight position={[2, 5, 3]} intensity={1.8} />
            <directionalLight position={[-2, -3, -2]} intensity={1.0} />
            <pointLight position={[0, 2, 2]} intensity={0.9} />
            <Environment preset="sunset" />
            <LureModel
              modelType={modelType}
              color={color}
              // Le dégradé 3 couleurs est activé pour LurePret5 et les anciens modèles compatibles.
              useGradient={
                modelType === "LurePret5" ||
                modelType === "Lure11" ||
                modelType === "Lure12" ||
                modelType === "Lure13" ||
                modelType === "Lure14" ||
                modelType === "Lure15" ||
                modelType === "Lure16" ||
                modelType === "Lure17" ||
                modelType === "Lure18" ||
                modelType === "Lure19" ||
                modelType === "Lure20" ||
                modelType === "Lure21" ||
                modelType === "Lure22" ||
                modelType === "Lure29"
              }
              gradientTop={gradientTop}
              gradientMiddle={gradientMiddle}
              gradientBottom={gradientBottom}
              gradientSmoothness={gradientStrength / 100}
              gradientCenter={gradientPosition / 100}
              gradientAngle={gradientAngle}
              // On garde toujours un minimum de douceur pour que le bas reste visible,
              // même quand le slider est à 0.
              gradientSmoothness2={gradientStrength2 / 100}
              gradientCenter2={gradientPosition2 / 100}
              gradientTargetName={
                modelType === "LurePret5" ||
                modelType === "Lure12" ||
                modelType === "Lure13" ||
                modelType === "Lure14" ||
                modelType === "Lure15" ||
                modelType === "Lure16" ||
                modelType === "Lure17" ||
                modelType === "Lure18" ||
                modelType === "Lure19" ||
                modelType === "Lure20" ||
                modelType === "Lure21" ||
                modelType === "Lure22" ||
                modelType === "Lure29"
                  ? "Cube"
                  : null
              }
              runnerType={runnerType}
              maskType={maskType}
              collectionType={
                modelType === "Lure25" ||
                modelType === "Lure26" ||
                modelType === "Lure27" ||
                modelType === "Lure28" ||
                modelType === "Lure29"
                  ? collectionType
                  : null
              }
              textureUrl={selectedTexture}
              textureRotation={textureRotation}
              textureScale={textureScale}
              textureBlur={textureBlur}
              textureStrength={textureStrength}
              scalesStrength={scalesStrength}
              paletteType={modelType === "CollectionTest" ? paletteType : null}
              tripleSize={modelType === "Lurepret" ? tripleSize : null}
              frontTripleSize={
                modelType === "LurePret5"
                  ? frontTripleSize
                  : null
              }
              backTripleSize={
                modelType === "LurePret5"
                  ? backTripleSize
                  : null
              }
              backPaletteType={modelType === "LurePret5" ? backPaletteType : null}
              eyeWhiteColor={eyeWhiteColor}
              eyeIrisColor={eyeIrisColor}
              lureSize={lureSize}
              onComputedDimensionsCm={setCurrentDimensionsCm}
            />
            {/* Axes mondes X/Y/Z avec petits traits tous les 1 cm,
                et graduations (5, 10, 15...) ajustées à la taille du leurre */}
            <AxesWithTicks
              worldPerCm={currentDimensionsCm?.worldPerCm}
              lengthCm={currentDimensionsCm?.lengthCm}
            />
            {/* Gizmo façon Blender : axes X/Y/Z cliquables pour recadrer la vue */}
            <GizmoHelper alignment="top-right" margin={[80, 80]}>
              <GizmoViewport
                axisColors={["#ef4444", "#3b82f6", "#22c55e"]}
                labelColor="#e5e7eb"
              />
            </GizmoHelper>
            <OrbitControls
              enablePan={false}
              enableZoom
              target={[0, 0, 0]}
            />
          </Canvas>

          {/* Petit panneau texte avec les dimensions approx. du leurre,
              aligné avec le repère X/Y/Z en haut à droite */}
          <div className="lure-dimensions-panel">
            {currentDimensionsCm ? (
              <>
                <div>
                  <strong>X</strong>{" "}
                  {currentDimensionsCm.lengthCm.toFixed(1)}
                  {" cm"}
                </div>
                <div>
                  <strong>Y</strong>{" "}
                  {currentDimensionsCm.heightCm.toFixed(1)}
                  {" cm"}
                </div>
                <div>
                  <strong>Z</strong>{" "}
                  {currentDimensionsCm.widthCm.toFixed(1)}
                  {" cm"}
                </div>
              </>
            ) : (
              <span>Dimensions en cours de calcul…</span>
            )}
          </div>
        </div>

        <CreateLureSidebar
          user={user}
          navigate={navigate}
          modelType={modelType}
          setModelType={setModelType}
          runnerType={runnerType}
          setRunnerType={setRunnerType}
          collectionType={collectionType}
          setCollectionType={setCollectionType}
          frontTripleSize={frontTripleSize}
          setFrontTripleSize={setFrontTripleSize}
          backTripleSize={backTripleSize}
          setBackTripleSize={setBackTripleSize}
          backPaletteType={backPaletteType}
          setBackPaletteType={setBackPaletteType}
          gradientTop={gradientTop}
          setGradientTop={setGradientTop}
          gradientMiddle={gradientMiddle}
          setGradientMiddle={setGradientMiddle}
          gradientBottom={gradientBottom}
          setGradientBottom={setGradientBottom}
          gradientStrength={gradientStrength}
          setGradientStrength={setGradientStrength}
          gradientStrength2={gradientStrength2}
          setGradientStrength2={setGradientStrength2}
          gradientPosition={gradientPosition}
          setGradientPosition={setGradientPosition}
          gradientPosition2={gradientPosition2}
          setGradientPosition2={setGradientPosition2}
          gradientAngle={gradientAngle}
          setGradientAngle={setGradientAngle}
          maskType={maskType}
          setMaskType={setMaskType}
          color={color}
          setColor={setColor}
          eyeWhiteColor={eyeWhiteColor}
          setEyeWhiteColor={setEyeWhiteColor}
          eyeIrisColor={eyeIrisColor}
          setEyeIrisColor={setEyeIrisColor}
          lureSize={lureSize}
          setLureSize={setLureSize}
          paletteType={paletteType}
          setPaletteType={setPaletteType}
          selectedTexture={selectedTexture}
          setSelectedTexture={setSelectedTexture}
          textureRotation={textureRotation}
          setTextureRotation={setTextureRotation}
          textureScale={textureScale}
          setTextureScale={setTextureScale}
          textureBlur={textureBlur}
          setTextureBlur={setTextureBlur}
          textureStrength={textureStrength}
          setTextureStrength={setTextureStrength}
          scalesStrength={scalesStrength}
          setScalesStrength={setScalesStrength}
          error={error}
          creating={creating}
          onSubmit={handleSubmit}
          onLogout={() => supabase.auth.signOut()}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/new" element={<CreateLurePage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}


