import { useEffect } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import { PlasticGradientMaterial } from "./PlasticGradientMaterial";
import { attachTripleToLure } from "./tripleAttachment";
import { attachPaletteToLure } from "./paletteAttachment";

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
    case "TEestCubeglb":
      return `${import.meta.env.BASE_URL}models/TEestCubeglb.glb`;
    case "TEestCubeglb2":
      return `${import.meta.env.BASE_URL}models/TEestCubeglb2.glb`;
    case "TEestCubeglb14":
      return `${import.meta.env.BASE_URL}models/TEestCubeglb14.glb`;
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

  const spanU = Math.abs(size[axisU]) > 1e-5 ? size[axisU] : 1;
  const spanV = Math.abs(size[axisV]) > 1e-5 ? size[axisV] : 1;

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

export function LureModel({
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
  lureSize = "M", // "M" (base), "L" (x1.25), "XL" (x1.5)
  sizePresetsInch = null, // ex: [2, 2.5, 4] si défini dans Blender
  selectedSizeInch = null, // valeur actuelle en inch
  onComputedDimensionsCm = null,
  onHasBavetteSocketChange = null,
  onModelMetadataChange = null,
  selectedPart = null,
  onBodyClick = null,
  onEyesClick = null,
  showEyes = true,
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
        sizesInchRaw: "",
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
        if (!collected.sizesInchRaw) {
          collected.sizesInchRaw =
            ud.SizesInch ||
            ud.sizesInch ||
            ud.LureSizesInch ||
            ud.lureSizesInch ||
            "";
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
    //    ou via une Custom Property cmPerWorldUnit placée sur un objet Blender.
    if (!scene.userData.cmPerWorldUnit) {
      // D'abord, essayer de récupérer cmPerWorldUnit depuis un des enfants,
      // au cas où la propriété aurait été mise sur l'objet principal dans Blender.
      let hintedCmPerWorld = null;
      scene.traverse((child) => {
        if (hintedCmPerWorld != null) return;
        const ud = child.userData;
        if (
          ud &&
          typeof ud.cmPerWorldUnit === "number" &&
          ud.cmPerWorldUnit > 0
        ) {
          hintedCmPerWorld = ud.cmPerWorldUnit;
        }
      });
      if (hintedCmPerWorld != null) {
        scene.userData.cmPerWorldUnit = hintedCmPerWorld;
      }
    }

    let localRefInch = null;

    if (!scene.userData.cmPerWorldUnit) {
      let refCube = null;
      let refLengthCm = 4.0; // valeur par défaut

      // Cas particulier : modèle personnalisé avec cube de calibration local.
      // Si le GLB contient un objet nommé "Ref_Inch" dont la longueur réelle
      // correspond à 1 inch, on s'en sert pour déduire cmPerWorldUnit.
      if (!refCube) {
        const localRef = scene.getObjectByName("Ref_Inch");
        if (localRef) {
          refCube = localRef;
          localRefInch = localRef;
          refLengthCm = 2.54; // 1 inch en centimètres
        }
      }

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
    const hasBavetteSocketLocal = bavetteSocketNames.some(
      (name) => !!scene.getObjectByName(name),
    );
    if (typeof onHasBavetteSocketChange === "function") {
      onHasBavetteSocketChange(hasBavetteSocketLocal);
    }

    // 3) Normalisation du modèle (position/échelle) pour l'affichage
    if (!scene.userData.normalized) {
      // On calcule la bounding box en ignorant le cube de référence Ref_Inch,
      // qui sert uniquement à la calibration d'échelle.
      const box = new THREE.Box3();
      let hasBox = false;
      scene.traverse((child) => {
        if (!child.isMesh) return;
        if (child.name === "Ref_Inch") return;
        const childBox = new THREE.Box3().setFromObject(child);
        if (!hasBox) {
          box.copy(childBox);
          hasBox = true;
        } else {
          box.union(childBox);
        }
      });
      if (!hasBox) return;
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
    // - Cas 1 : tailles prédéfinies M / L / XL (leurres intégrés)
    // - Cas 2 : tailles physiques en inch fournies par Blender (sizePresetsInch)
    let sizeScale = 1.0;
    if (Array.isArray(sizePresetsInch) && sizePresetsInch.length > 0 && selectedSizeInch) {
      const baseInch = sizePresetsInch[0];
      if (baseInch > 0) {
        sizeScale = selectedSizeInch / baseInch;
      }
    } else {
      sizeScale = lureSize === "XL" ? 1.5 : lureSize === "L" ? 1.25 : 1.0;
    }
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

    // Enfin, masquer le cube de référence Ref_Inch s'il existe, pour qu'il ne
    // soit jamais visible dans l'app (il sert uniquement à la calibration).
    const refInchObj = scene.getObjectByName("Ref_Inch");
    if (refInchObj) {
      refInchObj.visible = false;
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
      if (!showEyes) {
        child.visible = false;
        return;
      }

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
              // Si aucune texture Pike n'est active, on met la force de texture à 0
              // pour éviter que le shader n'assombrisse tout le leurre (cas map == null).
              material.uniforms.textureStrength.value = hasTexture
                ? textureStrength
                : 0;
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
    sizePresetsInch,
    selectedSizeInch,
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

  // Gestion des clics : on utilise les noms de mesh courants pour distinguer
  // le corps du leurre et les yeux. Si ces noms changent côté Blender, il
  // suffira d'ajuster cette partie.
  if (onBodyClick || onEyesClick) {
    scene.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || "").toLowerCase();
      if (
        onEyesClick &&
        (name.includes("eye") || name.includes("oeil") || name.includes("iris"))
      ) {
        child.userData._clickTarget = "eyes";
      } else if (onBodyClick) {
        // Tout mesh qui n'est pas explicitement un œil est considéré comme corps
        child.userData._clickTarget = "body";
      }
    });
  }

  // Surbrillance de la partie sélectionnée (corps / yeux) via emissive jaune
  return (
    <primitive
      object={scene}
      onClick={(event) => {
        const target = event.object?.userData?._clickTarget;
        if (target === "eyes" && onEyesClick) {
          event.stopPropagation();
          onEyesClick();
        } else if (target === "body" && onBodyClick) {
          event.stopPropagation();
          onBodyClick();
        }
      }}
    />
  );
}

// Préchargement des modèles utilisés
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure26.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure27.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure28.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/Lure29.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/LurePret7.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/CollectionTest.glb`);
useGLTF.preload("/Palettes/PalettesV5.glb");
useGLTF.preload("/Triple/N_Triple_Asset.glb");

export default LureModel;



