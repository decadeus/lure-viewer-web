import { useEffect, useState, useRef, useMemo } from "react";
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
} from "@react-three/drei";
import { AxesWithTicks } from "./AxesOverlay";
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
      return `${import.meta.env.BASE_URL}models/LurePret7.glb`;
    case "LureDouble":
      return `${import.meta.env.BASE_URL}models/LureDouble.glb`;
    case "Shad":
      return `${import.meta.env.BASE_URL}models/Shad.glb`;
    case "Shad2":
      // Shad2 utilise désormais le fichier Shad5.glb (modèle final avec shade smooth + attaches RM*/RL*)
      return `${import.meta.env.BASE_URL}models/Shad5.glb`;
    case "LureTop":
      return `${import.meta.env.BASE_URL}models/LureTop.glb`;
    case "LureTop3":
      return `${import.meta.env.BASE_URL}models/LureTop3.glb`;
    default:
      // Fallback : tous les anciens modèles pointent maintenant sur LurePret7
      return `${import.meta.env.BASE_URL}models/LurePret7.glb`;
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
  // Optionnel : URL complète d'un modèle glb importé en local (blob: ou file:)
  modelUrl = null,
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
  textureRepeat = true, // true = RepeatWrapping, false = ClampToEdge (pas de recopie)
  textureOffsetU = 0, // décalage horizontal de la texture (UV.x)
  textureOffsetV = 0, // décalage vertical de la texture (UV.y)
  textureMarkColor = "#000000", // couleur des marques (zones sombres de la texture)
  textureMarkStrength = 1, // 0-1 intensité de la couleur des marques
  scalesStrength = 0, // 0 = pas d'écailles, 1 = écailles fortes
  paletteType = null, // ex: "Palette_H", "Palette_M" (depuis Palettes.glb)
  tripleSize = null, // ex: "Triple_#1", "Triple_#2", "Triple_#4", "Triple_#6" (depuis N_Triple_Asset.glb)
  frontTripleSize = null, // pour LurePret5 / Shad : taille du triple à l'avant
  backTripleSize = null, // pour LurePret5 / Shad : taille du triple à l'arrière
  backPaletteType = null, // pour LurePret5 : Palette_H / M / L à l'arrière
  eyeWhiteColor = "#ffffff", // couleur de la partie "Blanc" de l'œil (sclère)
  eyeIrisColor = "#000000", // couleur de la partie "Iris" autour de l'œil
  eyeGlowColor = "#ff0000", // couleur du halo autour de l'œil
  eyeGlowStrength = 0, // 0 = pas de halo, 1 = halo fort
  bavetteType = null, // ex: "BavetteM" / "BavetteL" pour LureTop
  bavettePackUrl = null, // chemin/URL du pack de bavettes (null => pack intégré)
  lureSize = "M", // \"M\" (base), \"L\" (x1.25), \"XL\" (x1.5)
  onComputedDimensionsCm = null,
  onHasBavetteSocketChange = null,
  onModelMetadataChange = null,
}) {
  const modelPath = modelUrl || getModelPath(modelType);
  const gltf = useGLTF(modelPath);
  const { scene } = gltf;

  // Résolution des chemins statiques (marche en dev et dans l'app desktop)
  const staticBase = import.meta.env.BASE_URL || "/";
  const resolveStaticPath = (p) => {
    if (!p) return p;
    // Ne pas toucher aux URLs déjà absolues (http, blob, data...)
    if (/^(https?:|blob:|data:)/i.test(p)) return p;
    return `${staticBase}${p.replace(/^\/+/, "")}`;
  };

  // Charger une texture (même si on ne l'utilise pas toujours) pour respecter les règles des hooks.
  const colorTexture = useTexture(
    resolveStaticPath(textureUrl || "textures/Pike-002.png"),
  );
  const scalesTexture = useTexture(resolveStaticPath("textures/Scales_001.png"));
  const hasTexture = !!textureUrl;
  // Fichier commun contenant toutes les palettes disponibles
  // (PalettesV5.glb avec points d'attache Palette_Attach_H/M/L)
  const palettesGltf = useGLTF(
    resolveStaticPath("Palettes/PalettesV5.glb"),
  );
  // Accessoire Triple (N_Triple_Asset.glb) pour certains leurres (plusieurs tailles)
  const tripleGltf = useGLTF(
    resolveStaticPath("Triple/N_Triple_Asset.glb"),
  );
  // Pack de bavettes (intégré ou importé) contenant BavetteM / BavetteL.
  // Si bavettePackUrl est défini (blob:...), on l'utilise tel quel.
  // Sinon, on utilise le pack intégré dans public/models/Pack_Bavette7.glb.
  const bavettePackPath = bavettePackUrl || "models/Pack_Bavette7.glb";
  const bavetteGltf = useGLTF(resolveStaticPath(bavettePackPath));
  // Modèles de référence pour la calibration des cm
  const referenceGltf = useGLTF(
    `${import.meta.env.BASE_URL}models/LurePret8.glb`,
  );
  const doubleRefGltf = useGLTF(
    `${import.meta.env.BASE_URL}models/LureDouble.glb`,
  );
  const shadRefGltf = useGLTF(
    `${import.meta.env.BASE_URL}models/Shad2.glb`,
  );

  useEffect(() => {
    if (!scene) return;

    // Renvoyer les métadonnées issues des Custom Properties Blender (userData).
    // On parcourt toute la scène pour être tolérant : le fabricant peut mettre
    // les propriétés sur le root, sur un Empty, sur le mesh principal, etc.
    if (onModelMetadataChange) {
      const collected = {
        description: "",
        fabricant: "",
        modele: "",
        name: "",
      };

      const applyFrom = (ud = {}) => {
        if (!ud) return;
        if (!collected.description) {
          collected.description =
            ud.Description ||
            ud.description ||
            ud.Desc ||
            ud.desc ||
            "";
        }
        if (!collected.fabricant) {
          collected.fabricant =
            ud.Fabricant ||
            ud.Fabriquant || // tolère la faute de frappe
            ud.manufacturer_name ||
            ud.Manufacturer ||
            ud.brand ||
            "";
        }
        if (!collected.modele) {
          collected.modele =
            ud.Modele ||
            ud.model_name ||
            ud.lure_model ||
            "";
        }
        if (!collected.name) {
          collected.name = ud.Name || ud.name || "";
        }
      };

      applyFrom(gltf.scene && gltf.scene.userData);
      applyFrom(scene.userData);
      scene.traverse((child) => {
        if (child.userData) applyFrom(child.userData);
      });

      onModelMetadataChange({ ...collected });
    }

    // Appliquer une éventuelle rotation de texture (agissant partout où colorTexture est utilisée),
    // et activer le RepeatWrapping pour que la texture puisse se répéter sur tout le corps.
    if (hasTexture && colorTexture) {
      const rotationRad = (textureRotation * Math.PI) / 180;
      colorTexture.center.set(0.5, 0.5);
      colorTexture.rotation = rotationRad;
      const wrapMode = textureRepeat
        ? THREE.RepeatWrapping
        : THREE.ClampToEdgeWrapping;
      colorTexture.wrapS = wrapMode;
      colorTexture.wrapT = wrapMode;
      // Déplacement du motif dans l'espace UV
      colorTexture.offset.set(textureOffsetU, textureOffsetV);
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

    // 1) Calibration unités 3D -> centimètres via un cube de référence
    if (!scene.userData.cmPerWorldUnit) {
      let refCube = null;
      let refLengthCm = 4.0; // valeur par défaut

      // Cas particulier : LureDouble possède ses propres cubes de référence
      if (modelType === "LureDouble" && doubleRefGltf?.scene) {
        const wantedName = lureSize === "L" ? "Taille_L" : "Taille_M";
        refCube =
          doubleRefGltf.scene.getObjectByName(wantedName) ||
          doubleRefGltf.scene.getObjectByName("Taille_M") ||
          doubleRefGltf.scene.getObjectByName("Taille_L");
        // Pour LureDouble, chaque cube de ref correspond à ~4 cm
        refLengthCm = 4.0;
      }

      // Cas particulier : Shad / Shad2 utilisent Shad2.glb avec Ref_M (4.0 cm) et Ref_L (4.51 cm)
      if (
        !refCube &&
        (modelType === "Shad" || modelType === "Shad2") &&
        shadRefGltf?.scene
      ) {
        const cubeM = shadRefGltf.scene.getObjectByName("Ref_M");
        const cubeL = shadRefGltf.scene.getObjectByName("Ref_L");

        if (lureSize === "L" && cubeL) {
          refCube = cubeL;
          refLengthCm = 4.51;
        } else if (lureSize === "M" && cubeM) {
          refCube = cubeM;
          refLengthCm = 4.0;
        } else if (cubeM) {
          refCube = cubeM;
          refLengthCm = 4.0;
        } else if (cubeL) {
          refCube = cubeL;
          refLengthCm = 4.51;
        }
      }

      // Fallback : cube Taille_M du modèle de référence LurePret8
      if (!refCube && referenceGltf?.scene) {
        refCube = referenceGltf.scene.getObjectByName("Taille_M");
      }

      if (refCube) {
        const refBox = new THREE.Box3().setFromObject(refCube);
        const refSize = refBox.getSize(new THREE.Vector3());
        const refLengthUnits = Math.abs(refSize.x) || 1;
        scene.userData.cmPerWorldUnit = refLengthCm / refLengthUnits;
      }
    }

    // 2) Détection facultative de sockets de bavette (par ex. "A-Bav")
    const bavetteSocketNames = ["A-Bav"];
    const hasBavetteSocket = bavetteSocketNames.some(
      (name) => !!scene.getObjectByName(name),
    );
    if (typeof onHasBavetteSocketChange === "function") {
      onHasBavetteSocketChange(hasBavetteSocket);
    }

    // 3) Normalisation du modèle (position/échelle) pour l'affichage
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

    // 4) Calcul des dimensions réelles approximatives du leurre en cm
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

    // 5) Shad / Shad2 : n'afficher que les attaches correspondant à la taille du leurre
    // - taille M  -> Attach_MF / Attach_MB visibles, Attach_LF / Attach_LB masqués
    // - taille L  -> Attach_LF / Attach_LB visibles, Attach_MF / Attach_MB masqués
    if (modelType === "Shad" || modelType === "Shad2") {
      const isLarge = lureSize === "L";
      const keepPrefix = isLarge ? "Attach_L" : "Attach_M";
      ["Attach_MF", "Attach_MB", "Attach_LF", "Attach_LB"].forEach((name) => {
        const obj = scene.getObjectByName(name);
        if (!obj) return;
        obj.visible = name.startsWith(keepPrefix);
      });
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

    // Appliquer le matériau plastique spécial dès qu'on a besoin
    // soit du dégradé 3 couleurs, soit des textures (marques, écailles, flou).
    const targetColor = new THREE.Color(color);
    const topColor = useGradient ? new THREE.Color(gradientTop) : targetColor.clone();
    const midColor = useGradient ? new THREE.Color(gradientMiddle) : targetColor.clone();
    const bottomColor = useGradient ? new THREE.Color(gradientBottom) : targetColor.clone();
    const wantsPlasticMaterial =
      useGradient || hasTexture || scalesStrength > 0;

    if (wantsPlasticMaterial) {
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

          // Utiliser le matériau plastique avec gradient pour le corps
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
              const scale = Math.max(0.1, textureScale || 1);
              // On applique l'échelle de la texture de façon isotrope (U et V),
              // comme avant le refactoring, pour que le slider "Taille texture"
              // agrandisse/rétrécisse vraiment le motif sur tout le corps.
              material.uniforms.mapScale.value.set(scale, scale);
            }
            if (material.uniforms.mapOffset) {
              material.uniforms.mapOffset.value.set(
                textureOffsetU,
                textureOffsetV,
              );
            }
            if (material.uniforms.blurRadius) {
              material.uniforms.blurRadius.value = textureBlur;
            }
            if (material.uniforms.textureStrength) {
              material.uniforms.textureStrength.value = textureStrength;
            }
            if (material.uniforms.markColor) {
              const mc = new THREE.Color(textureMarkColor || "#000000");
              material.uniforms.markColor.value.copy(mc);
            }
            if (material.uniforms.markStrength) {
              material.uniforms.markStrength.value =
                textureMarkStrength != null ? textureMarkStrength : 1.0;
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
    if (modelType === "LurePret5" || modelType === "Shad" || modelType === "Shad2") {
      // Nettoyer les éventuels triples présents sur les points d'attache concernés
      const tripleSockets =
        modelType === "LurePret5"
          ? ["Attach_Down_add", "Attach_Back_Add"]
          : ["Attach_MF", "Attach_MB", "Attach_LF", "Attach_LB"];

      tripleSockets.forEach((name) => {
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

      if (modelType === "LurePret5") {
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
      } else {
        // Shad / Shad2 : utiliser les attaches spécifiques M/L avant / arrière
        const useLarge = lureSize === "L";
        const frontSocket = useLarge ? "Attach_LF" : "Attach_MF";
        const backSocket = useLarge ? "Attach_LB" : "Attach_MB";

        if (frontTripleSize) {
          attachTripleToLure({
            scene,
            tripleGltf,
            tripleSize: frontTripleSize,
            socketName: frontSocket,
            lureScale: sizeScale,
          });
        }
        if (backTripleSize) {
          attachTripleToLure({
            scene,
            tripleGltf,
            tripleSize: backTripleSize,
            socketName: backSocket,
            lureScale: sizeScale,
          });
        }
      }
    }

    // Attache dynamique des bavettes (Pack_Bavette.glb) sur tout modèle
    // qui expose un socket nommé "A-Bav" (convention Blender).
    const socketName = "A-Bav";
    const socket = scene.getObjectByName(socketName);

    if (socket) {
      // Nettoyer les éventuelles bavettes existantes sur ce point d'attache
      socket.children
        .slice()
        .forEach((child) => {
          if (child.userData?.isAttachedBavette) {
            socket.remove(child);
          }
        });

      // Si une bavette est sélectionnée et que le pack est chargé, l'attacher
      if (bavetteType && bavetteGltf?.scene) {
        const source = bavetteGltf.scene.getObjectByName(bavetteType);
        if (source) {
          const clone = source.clone(true);
          clone.userData.isAttachedBavette = true;

          // Compense la mise à l'échelle globale du leurre pour garder
          // une taille physique cohérente de la bavette.
          const invScale = 1 / (scene.userData.currentSizeScale || 1);
          clone.scale.multiplyScalar(invScale);

          // Donner à la bavette un matériau plastique semi‑transparent
          clone.traverse((child) => {
            if (!child.isMesh) return;
            const mat = new THREE.MeshPhysicalMaterial({
              color: "#f3f4f6", // quasi blanc
              transparent: true,
              opacity: 0.6,
              roughness: 0.15,
              metalness: 0.0,
              clearcoat: 1.0,
              clearcoatRoughness: 0.05,
              transmission: 0.6, // effet "verre/plastique"
              thickness: 0.2,
            });
            child.material = mat;
          });

          // Positionner la bavette à l'origine du socket, mais conserver
          // son orientation locale telle que définie dans Blender.
          // C'est donc dans Blender que tu règles vraiment l'angle.
          clone.position.set(0, 0, 0);

          socket.add(clone);
        }
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
    textureRepeat,
    textureOffsetU,
    textureOffsetV,
    textureMarkColor,
    textureMarkStrength,
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
    bavetteType,
    bavetteGltf,
    eyeGlowColor,
    eyeGlowStrength,
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

// Axes 3D et graduations sont définis séparément dans `AxesOverlay.jsx`.

useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure26.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure27.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure28.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure29.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/LurePret7.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/CollectionTest.glb`);
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
  const [textureRepeat, setTextureRepeat] = useState(true); // true = répéter la texture
  const [textureOffsetU, setTextureOffsetU] = useState(0); // décalage horizontal
  const [textureOffsetV, setTextureOffsetV] = useState(0); // décalage vertical
  const [textureMarkColor, setTextureMarkColor] = useState("#000000");
  const [textureMarkStrength, setTextureMarkStrength] = useState(1); // 0-1
  const [paletteType, setPaletteType] = useState("Palette_H"); // palettes générales (avant)
  const [tripleSize, setTripleSize] = useState("Triple_#4"); // taille du triple à attacher (LurePret5 front/back)
  // Pour LurePret2 : tailles indépendantes pour l'attache avant / arrière.
  // null = aucun triple pour cette attache.
  const [frontTripleSize, setFrontTripleSize] = useState(null);
  const [backTripleSize, setBackTripleSize] = useState(null);
  const [backPaletteType, setBackPaletteType] = useState(null); // "Palette_H" | "Palette_M" | "Palette_L" | null
  // Sélection de bavette (pour les leurres compatibles, ex: LureTop)
  const [bavetteType, setBavetteType] = useState(null); // ex: "BavetteM", null = aucune
  const [eyeWhiteColor, setEyeWhiteColor] = useState("#ffffff");
  const [eyeIrisColor, setEyeIrisColor] = useState("#000000");
  const [eyeGlowColor, setEyeGlowColor] = useState("#ff0000");
  const [eyeGlowStrength, setEyeGlowStrength] = useState(0); // 0-1
  const [lureSize, setLureSize] = useState("M"); // M (base), L, XL
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  // Colonne gauche "à la Figma"
  // - leftMainTab: "file" => leurs enregistrés, "assets" => bibliothèques (modèles uniquement)
  // - assetsView: "root" => liste des bibliothèques, ou "models" pour le détail
  const [leftMainTab, setLeftMainTab] = useState("file"); // "file" | "assets"
  const [assetsView, setAssetsView] = useState("root"); // "root" | "models"
  // Modèles GLB importés localement (non sauvegardés sur le serveur)
  const [localModels, setLocalModels] = useState([]);
  const [selectedLocalModelId, setSelectedLocalModelId] = useState(null);
  // Textures importées localement
  const [localTextures, setLocalTextures] = useState([]);
  const glRef = useRef(null);
  const [currentDimensionsCm, setCurrentDimensionsCm] = useState(null);
  const [showAxes, setShowAxes] = useState(false);
  // Pack de bavettes sélectionné
  // - null => pack intégré (models/Pack_Bavette7.glb)
  // - url blob:... => pack importé localement
  const [selectedBavettePackUrl, setSelectedBavettePackUrl] = useState(null);
  const [localBavettePacks, setLocalBavettePacks] = useState([]);
  // Indique si le modèle courant possède un socket de bavette (ex: A-Bav)
  const [hasBavetteSocket, setHasBavetteSocket] = useState(false);
  // Onglet actif dans la colonne de droite (Ta / T / Bv / Tx / C / Yeux / Ax)
  const [activeToolTab, setActiveToolTab] = useState("size");
  // Barre d'assets en bas (façon Blender) : Modèles / Textures / Bavettes
  const [assetDockTab, setAssetDockTab] = useState("models"); // "models" | "textures" | "bavettes"
  const [assetDockOpen, setAssetDockOpen] = useState(true);
  const [assetDockHeight, setAssetDockHeight] = useState(220);
  const [modelMetadata, setModelMetadata] = useState(null);
  const [textureLibrary, setTextureLibrary] = useState("builtin"); // "builtin" | "local"
  const [bavetteThumbnails, setBavetteThumbnails] = useState({});

  // Charger le pack de bavettes correspondant (intégré ou importé) pour
  // pouvoir en extraire dynamiquement la liste des bavettes disponibles.
  const bavettePackPathForList =
    selectedBavettePackUrl || `${import.meta.env.BASE_URL}models/Pack_Bavette7.glb`;
  const bavettePackGltfForList = useGLTF(bavettePackPathForList);

  const bavetteOptions = useMemo(() => {
    const sceneBav = bavettePackGltfForList?.scene;
    if (!sceneBav) {
      return [{ key: null, label: "Aucune" }];
    }
    const names = new Set();
    sceneBav.traverse((child) => {
      if (child.isMesh && child.name) {
        if (child.name.toLowerCase().startsWith("bavette")) {
          names.add(child.name);
        }
      }
    });
    const sorted = Array.from(names).sort();
    return [
      { key: null, label: "Aucune" },
      ...sorted.map((name) => ({ key: name, label: name })),
    ];
  }, [bavettePackGltfForList]);

  // Générer des vignettes 2D pour chaque bavette du pack courant,
  // en rendant rapidement le mesh dans un mini renderer Three.js hors écran.
  useEffect(() => {
    if (!bavettePackGltfForList?.scene) return;
    if (typeof document === "undefined") return;

    let cancelled = false;

    const generateThumbnails = async () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 200;
        const height = 110;
        canvas.width = width;
        canvas.height = height;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          canvas,
        });
        renderer.setSize(width, height, false);

        const camera = new THREE.PerspectiveCamera(30, width / height, 0.01, 10);
        const scene = new THREE.Scene();
        scene.background = null;

        const light = new THREE.DirectionalLight(0xffffff, 1.2);
        light.position.set(2, 3, 2);
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        const result = {};

        // On saute l'entrée "Aucune" (key === null)
        const targets = bavetteOptions.filter((opt) => opt.key);

        for (const opt of targets) {
          const source = bavettePackGltfForList.scene.getObjectByName(opt.key);
          if (!source) continue;

          const clone = source.clone(true);
          scene.add(clone);

          // Calculer un cadrage propre autour de la bavette
          const box = new THREE.Box3().setFromObject(clone);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          const maxSize = Math.max(size.x, size.y, size.z) || 1;
          const distance = maxSize * 2.2;

          camera.position.set(center.x + distance, center.y + distance * 0.4, center.z + distance);
          camera.lookAt(center);
          camera.updateProjectionMatrix();

          renderer.render(scene, camera);
          result[opt.key] = renderer.domElement.toDataURL("image/png");

          scene.remove(clone);
        }

        renderer.dispose();

        if (!cancelled) {
          setBavetteThumbnails(result);
        }
      } catch (err) {
        // En cas de problème, on garde simplement les vignettes "placeholder"
        // eslint-disable-next-line no-console
        console.error("Erreur génération vignettes bavettes", err);
      }
    };

    generateThumbnails();

    return () => {
      cancelled = true;
    };
  }, [bavettePackGltfForList, bavetteOptions]);

  const selectedLocalModel =
    localModels.find((m) => m.id === selectedLocalModelId) || null;

  // Leurres enregistrés localement (configuration uniquement, sans Supabase)
  const [localLures, setLocalLures] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("lure-local-lures");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [activeLocalLureId, setActiveLocalLureId] = useState(null);

  // Popup custom pour choisir entre Modifier / Nouveau
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingLocalSave, setPendingLocalSave] = useState(null); // { previewUrl, baseEntry }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "lure-local-lures",
        JSON.stringify(localLures),
      );
    } catch {
      // ignore quota errors
    }
  }, [localLures]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (creating) return;

    // Générer une vignette basée sur le Canvas courant (si dispo)
    let previewUrl = null;
    if (glRef.current?.domElement) {
      try {
        previewUrl = glRef.current.domElement.toDataURL("image/png");
      } catch {
        // ignore
      }
    }

    const now = new Date();
    const baseEntry = {
      modelType,
      color,
      gradientTop,
      gradientMiddle,
      gradientBottom,
      gradientStrength,
      gradientPosition,
      gradientStrength2,
      gradientPosition2,
      gradientAngle,
      runnerType,
      maskType,
      collectionType,
      selectedTexture,
      textureRotation,
      textureScale,
      textureBlur,
      textureStrength,
      scalesStrength,
      textureMarkColor,
      textureMarkStrength,
      paletteType,
      frontTripleSize,
      backTripleSize,
      backPaletteType,
      eyeWhiteColor,
      eyeIrisColor,
      lureSize,
    };

    // Si un leurre local est sélectionné, ouvrir un popup custom pour choisir l'action
    if (activeLocalLureId) {
      setPendingLocalSave({ previewUrl, baseEntry, createdAt: now.toISOString() });
      setSaveDialogOpen(true);
    } else {
      // Sauvegarde locale simple (nouveau leurre)
      const localId = `local-${now.getTime()}`;
      const localEntry = {
        id: localId,
        created_at: now.toISOString(),
        previewUrl,
        ...baseEntry,
      };
      setLocalLures((prev) => [localEntry, ...prev]);
      setActiveLocalLureId(localId);
    }

    // Si l'utilisateur n'est pas connecté, on s'arrête à la sauvegarde locale
    if (!user) {
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
        {/* Popup de sauvegarde locale (Modifier / Nouveau / Annuler) */}
        {saveDialogOpen && pendingLocalSave && (
          <div className="save-dialog-backdrop">
            <div className="save-dialog">
              <p className="save-dialog-text">
                Que veux-tu faire avec ce leurre ?
              </p>
              <p className="save-dialog-subtext">
                <strong>Modifier</strong> met à jour le leurre sélectionné.{" "}
                <strong>Nouveau</strong> crée un autre leurre à partir de ces
                réglages.
              </p>
              <div className="save-dialog-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setSaveDialogOpen(false);
                    setPendingLocalSave(null);
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    // Créer un nouveau leurre local
                    const now = new Date();
                    const localId = `local-${now.getTime()}`;
                    const localEntry = {
                      id: localId,
                      created_at:
                        pendingLocalSave.createdAt || now.toISOString(),
                      previewUrl: pendingLocalSave.previewUrl || null,
                      ...pendingLocalSave.baseEntry,
                    };
                    setLocalLures((prev) => [localEntry, ...prev]);
                    setActiveLocalLureId(localId);
                    setSaveDialogOpen(false);
                    setPendingLocalSave(null);
                  }}
                >
                  Nouveau
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    // Mettre à jour le leurre sélectionné
                    setLocalLures((prev) =>
                      prev.map((lure) =>
                        lure.id === activeLocalLureId
                          ? {
                              ...lure,
                              ...pendingLocalSave.baseEntry,
                              previewUrl:
                                pendingLocalSave.previewUrl ||
                                lure.previewUrl ||
                                null,
                            }
                          : lure,
                      ),
                    );
                    setSaveDialogOpen(false);
                    setPendingLocalSave(null);
                  }}
                >
                  Modifier
                </button>
              </div>
            </div>
          </div>
        )}

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
              modelUrl={selectedLocalModel?.url || null}
              color={color}
              // Le dégradé 3 couleurs est activé pour LurePret5, Shad / Shad2 et les anciens modèles compatibles.
              useGradient={
                modelType === "LurePret5" ||
                modelType === "Shad" ||
                modelType === "Shad2" ||
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
              gradientSmoothness={0.2 + (0.8 * gradientStrength) / 100}
              gradientCenter={gradientPosition / 100}
              gradientAngle={gradientAngle}
              // On garde toujours un minimum de douceur pour que le bas reste visible,
              // même quand le slider est à 0.
              gradientSmoothness2={0.2 + (0.8 * gradientStrength2) / 100}
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
              textureRepeat={textureRepeat}
              textureOffsetU={textureOffsetU}
              textureOffsetV={textureOffsetV}
              textureMarkColor={textureMarkColor}
              textureMarkStrength={textureMarkStrength}
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
              // Pour l'instant, la bavette n'est pas encore attachée en 3D,
              // mais on garde le type sélectionné prêt pour une prochaine étape.
              bavetteType={bavetteType}
              // Pack de bavettes actuellement sélectionné (intégré ou importé)
              bavettePackUrl={selectedBavettePackUrl}
              eyeWhiteColor={eyeWhiteColor}
              eyeIrisColor={eyeIrisColor}
              eyeGlowColor={eyeGlowColor}
              eyeGlowStrength={eyeGlowStrength}
              lureSize={lureSize}
              onComputedDimensionsCm={setCurrentDimensionsCm}
              onHasBavetteSocketChange={setHasBavetteSocket}
              onModelMetadataChange={setModelMetadata}
            />
            {/* Axes mondes X/Y/Z avec petits traits et graduations,
                rassemblés dans un composant dédié (optionnel via showAxes) */}
            {showAxes && (
              <AxesWithTicks
                worldPerCm={currentDimensionsCm?.worldPerCm}
                lengthCm={currentDimensionsCm?.lengthCm}
              />
            )}
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

          {/* Panneau extensible façon Blender (menu en haut + contenu en dessous) */}
          {assetDockOpen && (
            <div
              className="asset-dock-panel"
              style={{ height: `${assetDockHeight}px` }}
            >
              <div
                className="asset-dock-resize-handle"
                onMouseDown={(event) => {
                  event.preventDefault();
                  const startY = event.clientY;
                  const startHeight = assetDockHeight;
                  const onMove = (e) => {
                    const delta = startY - e.clientY;
                    let next = startHeight + delta;
                    if (next < 64) next = 64; // hauteur minimale: juste le menu
                    if (next > 360) next = 360;
                    setAssetDockHeight(next);
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              />

              {/* Barre d'assets horizontale façon Blender : Modèles / Textures / Bavettes */}
              <div className="asset-dock-tabs">
                <button
                  type="button"
                  className={`asset-dock-tab-btn${
                    assetDockTab === "models" ? " asset-dock-tab-btn--active" : ""
                  }`}
                  onClick={() => setAssetDockTab("models")}
                >
                  Modèles
                </button>
                <button
                  type="button"
                  className={`asset-dock-tab-btn${
                    assetDockTab === "textures" ? " asset-dock-tab-btn--active" : ""
                  }`}
                  onClick={() => setAssetDockTab("textures")}
                >
                  Textures
                </button>
                <button
                  type="button"
                  className={`asset-dock-tab-btn${
                    assetDockTab === "bavettes" ? " asset-dock-tab-btn--active" : ""
                  }`}
                  onClick={() => setAssetDockTab("bavettes")}
                >
                  Bavettes
                </button>
              </div>

              <div className="asset-dock-main">
                {assetDockTab === "models" && (
                  <div className="asset-dock-row asset-dock-row--split">
                    <div className="asset-dock-items">
                      {/* Import local de modèles GLB */}
                      <div style={{ marginBottom: 8 }}>
                        <label
                          className="secondary-btn"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          Importer un modèle (.glb)
                          <input
                            type="file"
                            accept=".glb"
                            multiple
                            style={{ display: "none" }}
                            onChange={(event) => {
                              const files = Array.from(event.target.files || []);
                              if (!files.length) return;
                              const now = Date.now();
                              const newEntries = files.map((file, index) => ({
                                id: `${now}-${index}-${file.name}`,
                                name: file.name.replace(/\.glb$/i, ""),
                                url: URL.createObjectURL(file),
                                previewUrl: null,
                              }));
                              setLocalModels((prev) => [...prev, ...newEntries]);
                              const last = newEntries[newEntries.length - 1];
                              setSelectedLocalModelId(last.id);
                              setModelType("Custom");
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {/* Modèles intégrés */}
                      <span className="asset-dock-section-title">
                        Modèles intégrés
                      </span>
                      <div
                        className="model-list model-list--grid"
                        style={{ marginTop: 4 }}
                      >
                        {[
                          "LurePret5",
                          "LureDouble",
                          "Shad",
                          "Shad2",
                          "LureTop",
                          "LureTop3",
                        ].map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`model-item model-item--thumb-only${
                              modelType === type && !selectedLocalModel
                                ? " model-item--active"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedLocalModelId(null);
                              setModelType(type);
                            }}
                          >
                            <div className="model-thumb model-thumb--placeholder">
                              {type.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="model-name">{type}</div>
                          </button>
                        ))}
                      </div>

                      {/* Modèles importés en local */}
                      {localModels.length > 0 && (
                        <>
                          <span
                            className="asset-dock-section-title"
                            style={{ display: "block", marginTop: 10 }}
                          >
                            Modèles importés (local)
                          </span>
                          <div
                            className="model-list model-list--grid"
                            style={{ marginTop: 4 }}
                          >
                            {localModels.map((m) => (
                              <div
                                key={m.id}
                                className={`model-item model-item--thumb-only${
                                  selectedLocalModelId === m.id
                                    ? " model-item--active"
                                    : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  className="model-thumb-button"
                                  onClick={() => {
                                    setSelectedLocalModelId(m.id);
                                    setModelType("Custom");
                                  }}
                                >
                                  {m.previewUrl ? (
                                    <img
                                      src={m.previewUrl}
                                      alt={m.name}
                                      className="model-thumb"
                                    />
                                  ) : (
                                    <div className="model-thumb model-thumb--placeholder">
                                      {m.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="model-name">{m.name}</div>
                                </button>
                                <button
                                  type="button"
                                  className="model-thumb-delete"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setLocalModels((prev) =>
                                      prev.filter((x) => x.id !== m.id),
                                    );
                                    if (selectedLocalModelId === m.id) {
                                      setSelectedLocalModelId(null);
                                    }
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="asset-dock-meta">
                      <h3 className="asset-dock-meta-title">Infos modèle (GLB)</h3>
                      <div className="asset-dock-meta-row">
                        <span>Nom</span>
                        <span>{modelMetadata?.name || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Fabricant</span>
                        <span>{modelMetadata?.fabricant || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Modèle</span>
                        <span>{modelMetadata?.modele || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row asset-dock-meta-row--description">
                        <span>Description</span>
                        <span>{modelMetadata?.description || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {assetDockTab === "textures" && (
                  <div className="asset-dock-row">
                    <div className="asset-dock-packs">
                      <div className="asset-dock-section-title">
                        Packs de textures
                      </div>
                      <div className="asset-dock-pack-list">
                        <button
                          type="button"
                          className={`asset-dock-pack-btn${
                            textureLibrary === "builtin"
                              ? " asset-dock-pack-btn--active"
                              : ""
                          }`}
                          onClick={() => setTextureLibrary("builtin")}
                        >
                          Intégrées
                        </button>
                        <button
                          type="button"
                          className={`asset-dock-pack-btn${
                            textureLibrary === "local"
                              ? " asset-dock-pack-btn--active"
                              : ""
                          }`}
                          disabled={localTextures.length === 0}
                          onClick={() => setTextureLibrary("local")}
                        >
                          Importées (local)
                        </button>
                      </div>
                      <label
                        className="secondary-btn asset-dock-import-btn"
                        style={{ cursor: "pointer" }}
                      >
                        Ajouter des textures (.png)
                        <input
                          type="file"
                          accept=".png"
                          multiple
                          style={{ display: "none" }}
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            if (!files.length) return;
                            const now = Date.now();
                            const entries = files.map((file, index) => ({
                              id: `${now}-${index}-${file.name}`,
                              name: file.name.replace(/\.[^.]+$/i, ""),
                              url: URL.createObjectURL(file),
                            }));
                            setLocalTextures((prev) => [...prev, ...entries]);
                            setTextureLibrary("local");
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    <div className="asset-dock-items">
                      {textureLibrary === "builtin" && (
                        <div className="texture-list">
                          {[
                            {
                              key: "textures/Pike-002.png",
                              name: "Pike 1",
                            },
                            {
                              key: "textures/Pike_003.png",
                              name: "Pike 2",
                            },
                          ].map((tex) => (
                            <button
                              key={tex.key}
                              type="button"
                              className={`texture-item${
                                selectedTexture === tex.key
                                  ? " texture-item--active"
                                  : ""
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
                      )}

                      {textureLibrary === "local" && localTextures.length > 0 && (
                        <div className="texture-list">
                          {localTextures.map((tex) => (
                            <div
                              key={tex.id}
                              className={`texture-item${
                                selectedTexture === tex.url
                                  ? " texture-item--active"
                                  : ""
                              }`}
                            >
                              <div
                                className="texture-thumb-wrapper"
                                onClick={() =>
                                  setSelectedTexture((current) =>
                                    current === tex.url ? null : tex.url,
                                  )
                                }
                              >
                                <div
                                  className="texture-thumb"
                                  style={{
                                    backgroundImage: `url(${tex.url})`,
                                  }}
                                />
                                <button
                                  type="button"
                                  className="texture-delete-btn"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setLocalTextures((prev) =>
                                      prev.filter((x) => x.id !== tex.id),
                                    );
                                    if (selectedTexture === tex.url) {
                                      setSelectedTexture(null);
                                    }
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              <div className="texture-meta">
                                <span className="texture-name">{tex.name}</span>
                                <span className="texture-tag">
                                  {selectedTexture === tex.url
                                    ? "Utilisée sur le leurre"
                                    : "Cliquer pour appliquer"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {textureLibrary === "local" && localTextures.length === 0 && (
                        <p className="asset-dock-empty-text">
                          Aucune texture locale importée pour le moment.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {assetDockTab === "bavettes" && (
                  <div className="asset-dock-row">
                    <div className="asset-dock-packs">
                      <div className="asset-dock-section-title">
                        Packs de bavettes
                      </div>
                      <label
                        className="secondary-btn asset-dock-import-btn"
                        style={{ cursor: "pointer" }}
                      >
                        Importer un pack de bavettes (.glb)
                        <input
                          type="file"
                          accept=".glb"
                          multiple
                          style={{ display: "none" }}
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            if (!files.length) return;
                            const now = Date.now();
                            const newEntries = files.map((file, index) => ({
                              id: `${now}-${index}-${file.name}`,
                              name: file.name.replace(/\.glb$/i, ""),
                              url: URL.createObjectURL(file),
                            }));
                            setLocalBavettePacks((prev) => [...prev, ...newEntries]);
                            const last = newEntries[newEntries.length - 1];
                            setSelectedBavettePackUrl(last.url);
                            setActiveToolTab("bavette");
                            event.target.value = "";
                          }}
                        />
                      </label>

                      <div className="asset-dock-pack-list">
                        <button
                          type="button"
                          className={`asset-dock-pack-btn${
                            !selectedBavettePackUrl
                              ? " asset-dock-pack-btn--active"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedBavettePackUrl(null);
                            setActiveToolTab("bavette");
                          }}
                        >
                          Pack intégré (Pack_Bavette7)
                        </button>

                        {localBavettePacks.length > 0 &&
                          localBavettePacks.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`asset-dock-pack-btn${
                                selectedBavettePackUrl === p.url
                                  ? " asset-dock-pack-btn--active"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedBavettePackUrl(p.url);
                                setActiveToolTab("bavette");
                              }}
                            >
                              {p.name}
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="asset-dock-items">
                      {bavetteOptions && bavetteOptions.length > 0 ? (
                        <div className="bavette-grid">
                          {bavetteOptions.map((opt) =>
                            opt.key === null ? null : (
                              <button
                                key={opt.key}
                                type="button"
                                className={`bavette-card${
                                  bavetteType === opt.key
                                    ? " bavette-card--active"
                                    : ""
                                }`}
                                onClick={() =>
                                  setBavetteType((current) =>
                                    current === opt.key ? null : opt.key,
                                  )
                                }
                              >
                                <div
                                  className="bavette-card-thumb"
                                  style={
                                    bavetteThumbnails[opt.key]
                                      ? {
                                          backgroundImage: `url(${bavetteThumbnails[opt.key]})`,
                                          backgroundSize: "contain",
                                          backgroundRepeat: "no-repeat",
                                          backgroundPosition: "center",
                                        }
                                      : undefined
                                  }
                                />
                                <span className="bavette-card-label">
                                  {opt.label}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="asset-dock-empty-text">
                          Aucun mesh commençant par &quot;Bavette&quot; trouvé dans
                          le pack sélectionné.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
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
          bavetteType={bavetteType}
          setBavetteType={setBavetteType}
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
          eyeGlowColor={eyeGlowColor}
          setEyeGlowColor={setEyeGlowColor}
          eyeGlowStrength={eyeGlowStrength}
          setEyeGlowStrength={setEyeGlowStrength}
          lureSize={lureSize}
          setLureSize={setLureSize}
          modelMetadata={modelMetadata}
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
          textureRepeat={textureRepeat}
          setTextureRepeat={setTextureRepeat}
          textureOffsetU={textureOffsetU}
          setTextureOffsetU={setTextureOffsetU}
          textureOffsetV={textureOffsetV}
          setTextureOffsetV={setTextureOffsetV}
          textureMarkColor={textureMarkColor}
          setTextureMarkColor={setTextureMarkColor}
          textureMarkStrength={textureMarkStrength}
          setTextureMarkStrength={setTextureMarkStrength}
          hasBavetteSocket={
            hasBavetteSocket ||
            modelType === "LureTop" ||
            modelType === "LureTop3"
          }
          activeToolTab={activeToolTab}
          setActiveToolTab={setActiveToolTab}
          bavetteOptions={bavetteOptions}
          showAxes={showAxes}
          setShowAxes={setShowAxes}
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
      {/* On utilise désormais uniquement la page de création comme écran principal */}
      <Route path="/" element={<CreateLurePage />} />
      <Route path="/new" element={<CreateLurePage />} />
      <Route path="/auth" element={<AuthPage />} />
    </Routes>
  );
}


