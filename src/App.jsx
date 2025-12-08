import { useEffect, useState, useRef } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import "./App.css";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage.jsx";
import { GradientMaterial } from "./GradientMaterial";
import { PlasticGradientMaterial } from "./PlasticGradientMaterial";
import { attachTripleToLure } from "./tripleAttachment";

// ----------- Utilitaires modèle 3D -----------

function getModelPath(modelType) {
  switch (modelType) {
    case "CollectionTest":
      return "/models/CollectionTest.glb";
    case "Lurepret":
      return "/models/Lurepret.glb";
    case "LurePret2":
      return "/models/LurePret2.glb";
    case "LurePret3":
      return "/models/LurePret3.glb";
    case "LurePret4":
      return "/models/LurePret4.glb";
    case "LurePret5":
      return "/models/LurePret5.glb";
    case "Lure26":
      return "/models/Lure26.glb";
    case "Lure27":
      return "/models/Lure27.glb";
    case "Lure28":
      return "/models/Lure28.glb";
    case "Lure29":
      return "/models/Lure29.glb";
    default:
      // fallback sûr pour les anciens enregistrements (Lure1-25) :
      return "/models/Lure29.glb";
  }
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
  gradientTargetName = null,
  runnerType = null,
  maskType = "none",
  collectionType = null, // "Palette" | "Hoo_B" | null
  textureUrl = null,
  paletteType = null, // ex: "Palette_H", "Palette_M" (depuis Palettes.glb)
  tripleSize = null, // ex: "Triple_#1", "Triple_#2", "Triple_#4", "Triple_#6" (depuis N_Triple_Asset.glb)
  frontTripleSize = null, // pour LurePret2/LurePret3/LurePret4 : taille du triple à l'avant
  backTripleSize = null, // pour LurePret2/LurePret3/LurePret4 : taille du triple à l'arrière
}) {
  const modelPath = getModelPath(modelType);
  const gltf = useGLTF(modelPath);
  const { scene } = gltf;
  // Charger une texture (même si on ne l'utilise pas toujours) pour respecter les règles des hooks.
  const colorTexture = useTexture(textureUrl || "/textures/piketexture2.png");
  const hasTexture = !!textureUrl;
  // Fichier commun contenant toutes les palettes disponibles
  const palettesGltf = useGLTF("/Palettes/Correct_Palettes.glb");
  // Accessoire Triple (N_Triple_Asset.glb) pour certains leurres (plusieurs tailles)
  const tripleGltf = useGLTF("/Triple/N_Triple_Asset.glb");

  useEffect(() => {
    // DEBUG: vérifier que le bon modèle est bien utilisé
    // eslint-disable-next-line no-console
    console.log("LureModel debug", { modelType, modelPath });

    if (!scene) return;

    // DEBUG (désactivé) : affichage des textures GLTF
    // if (gltf.textures && gltf.textures.length) {
    //   // eslint-disable-next-line no-console
    //   console.warn(
    //     "GLTF textures for",
    //     modelType,
    //     (gltf.textures || []).map((t) => t.name || (t.image && t.image.name)),
    //   );
    // }

    if (!scene.userData.normalized) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      scene.position.sub(center);
      const scaleFactor = 1.5 / maxDim;
      scene.scale.setScalar(scaleFactor);

      // stocker les bornes verticales normalisées pour le shader de dégradé
      const normalizedBox = new THREE.Box3().setFromObject(scene);
      scene.userData.gradientHeightMin = normalizedBox.min.y;
      scene.userData.gradientHeightMax = normalizedBox.max.y;

      scene.userData.normalized = true;
    }

    // Pour certains modèles (Lurepret / LurePret2 / 3 / 4 / 5), on force un
    // recalcul des normales côté Three.js pour éviter l'effet "facettes"
    // même si le GLB n'a pas été exporté avec le bon lissage.
    if (
      modelType === "Lurepret" ||
      modelType === "LurePret2" ||
      modelType === "LurePret3" ||
      modelType === "LurePret4" ||
      modelType === "LurePret5"
    ) {
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

    // Forcer les yeux en noir et brillants si présents
    scene.traverse((child) => {
      if (
        child.isMesh &&
        (child.name === "Oeil_Droit" || child.name === "Oeil_Gauche") &&
        child.material &&
        child.material.color
      ) {
        child.material.color.set("#000000");

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
      const heightMin =
        typeof scene.userData.gradientHeightMin === "number"
          ? scene.userData.gradientHeightMin
          : -0.75;
      const heightMax =
        typeof scene.userData.gradientHeightMax === "number"
          ? scene.userData.gradientHeightMax
          : 0.75;

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

            if (material.uniforms.glossiness) {
              material.uniforms.glossiness.value = 0.9;
            }
            if (material.uniforms.specularStrength) {
              material.uniforms.specularStrength.value = 1.4;
            }
            if (material.uniforms.envStrength) {
              material.uniforms.envStrength.value = 0.4;
            }

            // Appliquer éventuelle texture de couleur (pike, etc.)
            if (material.uniforms.map) {
              material.uniforms.map.value = hasTexture ? colorTexture : null;
            }
          }
        }
      });
      return;
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

        // Ne pas recolorer les yeux (ils restent noirs brillants)
        if (child.name === "Oeil_Droit" || child.name === "Oeil_Gauche") {
          return;
        }

        // Ne pas recolorer les yeux (ils restent noirs brillants)
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
          // Si une texture de couleur est active (ex: Pike), on l'applique
          if (hasTexture && colorTexture) {
            mat.map = colorTexture;
            mat.needsUpdate = true;
          }

          if (isPaletteLure) {
            // Aspect plastique brillant : moins métallique, un peu plus de roughness
            mat.roughness = 0.16;
            mat.metalness = 0.35;
            mat.envMapIntensity = 1.8;
            if ("clearcoat" in mat) {
              mat.clearcoat = 1.0;
              mat.clearcoatRoughness = 0.06;
            }
          } else {
            // Aspect très métallique pour les autres leurres
            mat.roughness = 0.03; // quasi miroir
            mat.metalness = 0.85; // très métallique
            mat.envMapIntensity = 3.0;
            if ("clearcoat" in mat) {
              mat.clearcoat = 1.0;
              mat.clearcoatRoughness = 0.02;
            }
          }
        }
      }
    });
    // Attache dynamique des palettes externes (Palettes.glb) via un Empty "socket"
    if (paletteType && palettesGltf?.scene && scene) {
      const socketName = "PaletteSocket_Front";
      const socket = scene.getObjectByName(socketName);

      if (socket) {
        // Supprimer les anciennes palettes ajoutées précédemment sur ce socket
        socket.children
          .slice()
          .forEach((child) => {
            if (child.userData?.isAttachedPalette) {
              socket.remove(child);
            }
          });

        const sourcePalette = palettesGltf.scene.getObjectByName(paletteType);
        if (sourcePalette) {
          const clone = sourcePalette.clone(true);
          // Cloner aussi les matériaux pour éviter les effets de bord entre instances
          clone.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material = child.material.clone();
            }
          });
          clone.userData = { ...(clone.userData || {}), isAttachedPalette: true };
          socket.add(clone);
        }
      }
    }

    // Attache dynamique du Triple (N_Triple_Asset.glb) via les repères.
    if (modelType === "Lurepret") {
      if (tripleSize) {
        attachTripleToLure({ scene, tripleGltf, tripleSize });
      }
    } else if (
      modelType === "LurePret2" ||
      modelType === "LurePret3" ||
      modelType === "LurePret4" ||
      modelType === "LurePret5"
    ) {
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
        });
      }
      if (backTripleSize) {
        attachTripleToLure({
          scene,
          tripleGltf,
          tripleSize: backTripleSize,
          socketName: "Attach_Back_Add",
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
    gradientTargetName,
    runnerType,
    maskType,
    collectionType,
    colorTexture,
    hasTexture,
    palettesGltf,
    paletteType,
    tripleGltf,
    tripleSize,
    frontTripleSize,
    backTripleSize,
  ]);

  return <primitive object={scene} />;
}

// Slider avec 2 curseurs (bas / haut) sur une seule barre, utilisé pour le gradient 3 couleurs
function DualPositionSlider({ min = 0, max = 100, valueLow, valueHigh, onChange }) {
  const trackRef = useRef(null);

  const clampValue = (val) => Math.min(max, Math.max(min, val));

  const handlePointerDown = (which) => (event) => {
    event.preventDefault();
    event.stopPropagation();

    const getClientX = (e) => {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      return e.clientX;
    };

    const move = (moveEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = getClientX(moveEvent);
      const ratio = (clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      const val = clampValue(Math.round(raw));

      let low = valueLow;
      let high = valueHigh;

      if (which === "low") {
        low = Math.min(val, high - 1);
      } else {
        high = Math.max(val, low + 1);
      }

      onChange(low, high);
    };

    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move);
    window.addEventListener("touchend", up);

    move(event);
  };

  const range = max - min || 1;
  const lowPct = ((valueLow - min) / range) * 100;
  const highPct = ((valueHigh - min) / range) * 100;

  return (
    <div className="dual-range">
      <div className="dual-range-track" ref={trackRef}>
        <div
          className="dual-range-fill"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <button
          type="button"
          className="dual-range-thumb"
          style={{ left: `${lowPct}%` }}
          onMouseDown={handlePointerDown("low")}
          onTouchStart={handlePointerDown("low")}
        />
        <button
          type="button"
          className="dual-range-thumb"
          style={{ left: `${highPct}%` }}
          onMouseDown={handlePointerDown("high")}
          onTouchStart={handlePointerDown("high")}
        />
      </div>
    </div>
  );
}

useGLTF.preload("/models/Lure26.glb");
useGLTF.preload("/models/Lure27.glb");
useGLTF.preload("/models/Lure28.glb");
useGLTF.preload("/models/Lure29.glb");
useGLTF.preload("/models/Lurepret.glb");
useGLTF.preload("/models/LurePret2.glb");
useGLTF.preload("/models/LurePret3.glb");
useGLTF.preload("/models/LurePret4.glb");
useGLTF.preload("/models/LurePret5.glb");
useGLTF.preload("/models/CollectionTest.glb");
useGLTF.preload("/Palettes/Correct_Palettes.glb");
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
  const [modelType, setModelType] = useState("Lure26");
  const [color, setColor] = useState("#ff0000");
  const [gradientTop, setGradientTop] = useState("#ff5500");
  const [gradientMiddle, setGradientMiddle] = useState("#ffffff");
  const [gradientBottom, setGradientBottom] = useState("#00ffaa");
  const [gradientStrength, setGradientStrength] = useState(100); // 0-100 (haut/milieu)
  const [gradientPosition, setGradientPosition] = useState(33); // 0-100, 0=bas, 100=haut (frontière haut/milieu)
  const [gradientStrength2, setGradientStrength2] = useState(100); // 0-100 (milieu/bas)
  const [gradientPosition2, setGradientPosition2] = useState(66); // 0-100 (frontière milieu/bas)
  const [runnerType, setRunnerType] = useState("SlallowRunner");
  const [maskType, setMaskType] = useState("none"); // "none" | "pike" | "card"
  const [collectionType, setCollectionType] = useState("Palette"); // pour Lure25/26/27/28 : "Palette" | "Hoo_B"
  const [usePikeTexture, setUsePikeTexture] = useState(false);
  const [paletteType, setPaletteType] = useState("Palette_H"); // pour CollectionTest + Palettes.glb
  const [tripleSize, setTripleSize] = useState("Triple_#4"); // taille du triple à attacher sur Lurepret
  // Pour LurePret2 : tailles indépendantes pour l'attache avant / arrière.
  // null = aucun triple pour cette attache.
  const [frontTripleSize, setFrontTripleSize] = useState(null);
  const [backTripleSize, setBackTripleSize] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  // Colonne gauche "à la Figma"
  // - leftMainTab: "file" => leurs enregistrés, "assets" => bibliothèques (textures / modèles)
  // - assetsView: "root" => liste des bibliothèques, ou "textures" / "models" pour le détail
  const [leftMainTab, setLeftMainTab] = useState("file"); // "file" | "assets"
  const [assetsView, setAssetsView] = useState("root"); // "root" | "textures" | "models"
  const glRef = useRef(null);

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
                  <button
                    type="button"
                    className={`texture-item${
                      usePikeTexture ? " texture-item--active" : ""
                    }`}
                    onClick={() => setUsePikeTexture((v) => !v)}
                  >
                    <div className="texture-thumb texture-thumb--pike" />
                    <div className="texture-meta">
                      <span className="texture-name">Texture Pike</span>
                      <span className="texture-tag">
                        {usePikeTexture
                          ? "Utilisée sur le leurre"
                          : "Cliquer pour appliquer"}
                      </span>
                    </div>
                  </button>
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
                  {[
                    "Lure26",
                    "Lure27",
                    "Lure28",
                    "Lure29",
                    "Lurepret",
                    "LurePret2",
                    "LurePret3",
                    "LurePret4",
                    "LurePret5",
                    "CollectionTest",
                  ].map(
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
              useGradient={
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
              // On garde toujours un minimum de douceur pour que le bas reste visible,
              // même quand le slider est à 0.
              gradientSmoothness2={gradientStrength2 / 100}
              gradientCenter2={gradientPosition2 / 100}
              gradientTargetName={
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
              textureUrl={usePikeTexture ? "/textures/piketexture2.png" : null}
              paletteType={modelType === "CollectionTest" ? paletteType : null}
              tripleSize={modelType === "Lurepret" ? tripleSize : null}
              frontTripleSize={
                modelType === "LurePret2" ||
                modelType === "LurePret3" ||
                modelType === "LurePret4" ||
                modelType === "LurePret5"
                  ? frontTripleSize
                  : null
              }
              backTripleSize={
                modelType === "LurePret2" ||
                modelType === "LurePret3" ||
                modelType === "LurePret4" ||
                modelType === "LurePret5"
                  ? backTripleSize
                  : null
              }
            />
            <OrbitControls
              enablePan={false}
              enableZoom
              target={[0, 0, 0]}
            />
          </Canvas>
        </div>

        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
              <h1 className="app-title">Nouveau leurre</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate("/")}
              >
                Retour à la liste
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <section className="panel" style={{ marginBottom: 12 }}>
              <h2 className="panel-title">Type de leurre</h2>
              <div className="color-picker-row">
                <span>Modèle</span>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  style={{ flex: 1, padding: "6px 8px" }}
                >
                  {[
                    "Lure26",
                    "Lure27",
                    "Lure28",
                    "Lure29",
                    "Lurepret",
                    "LurePret2",
                    "LurePret3",
                    "LurePret4",
                    "LurePret5",
                    "CollectionTest",
                  ].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </section>

            <section className="panel" style={{ marginBottom: 12 }}>
              <h2 className="panel-title">Type de nage</h2>
              <div className="home-type-filters">
                {["SlallowRunner", "MediumRunner", "DeepRunner"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`home-type-filter-btn${
                      runnerType === type ? " home-type-filter-btn--active" : ""
                    }`}
                    onClick={() => setRunnerType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </section>

            {(modelType === "Lure25" ||
              modelType === "Lure26" ||
              modelType === "Lure27" ||
              modelType === "Lure28" ||
              modelType === "Lure29") && (
              <section className="panel">
                <h2 className="panel-title">Collection (Palette / Hoo_B)</h2>
                <div className="home-type-filters">
                  {[
                    { key: "Palette", label: "Palette" },
                    { key: "Hoo_B", label: "Hoo_B" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`home-type-filter-btn${
                        collectionType === opt.key
                          ? " home-type-filter-btn--active"
                          : ""
                      }`}
                      onClick={() => setCollectionType(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {modelType === "Lurepret" && (
              <section className="panel">
                <h2 className="panel-title">Triple (taille)</h2>
                <div className="home-type-filters">
                  {[
                    { key: "Triple_#1", label: "#1" },
                    { key: "Triple_#2", label: "#2" },
                    { key: "Triple_#4", label: "#4" },
                    { key: "Triple_#6", label: "#6" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`home-type-filter-btn${
                        tripleSize === opt.key ? " home-type-filter-btn--active" : ""
                      }`}
                      onClick={() => setTripleSize(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(modelType === "LurePret2" ||
              modelType === "LurePret3" ||
              modelType === "LurePret4" ||
              modelType === "LurePret5") && (
              <section className="panel">
                <h2 className="panel-title">Triple devant</h2>
                <div className="home-type-filters" style={{ marginBottom: 8 }}>
                  {[
                    { key: null, label: "Aucun" },
                    { key: "Triple_#1", label: "#1" },
                    { key: "Triple_#2", label: "#2" },
                    { key: "Triple_#4", label: "#4" },
                    { key: "Triple_#6", label: "#6" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`home-type-filter-btn${
                        frontTripleSize === opt.key ? " home-type-filter-btn--active" : ""
                      }`}
                      onClick={() =>
                        setFrontTripleSize((current) =>
                          current === opt.key ? null : opt.key,
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <h2 className="panel-title" style={{ marginTop: 12 }}>
                  Triple derrière
                </h2>
                <div className="home-type-filters">
                  <button
                    type="button"
                    className={`home-type-filter-btn${
                      backTripleSize === null ? " home-type-filter-btn--active" : ""
                    }`}
                    onClick={() => setBackTripleSize(null)}
                  >
                    Aucun
                  </button>
                  {[
                    { key: "Triple_#1", label: "#1" },
                    { key: "Triple_#2", label: "#2" },
                    { key: "Triple_#4", label: "#4" },
                    { key: "Triple_#6", label: "#6" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`home-type-filter-btn${
                        backTripleSize === opt.key ? " home-type-filter-btn--active" : ""
                      }`}
                      onClick={() =>
                        setBackTripleSize((current) =>
                          current === opt.key ? null : opt.key,
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="panel">
              <h2 className="panel-title">Couleur du leurre</h2>
              {modelType === "Lure11" ||
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
              modelType === "Lure29" ? (
                <>
                  <div className="color-picker-row">
                    <span>Couleur haut</span>
                    <input
                      type="color"
                      value={gradientTop}
                      onChange={(e) => setGradientTop(e.target.value)}
                    />
                  </div>
                  <div className="color-picker-row">
                    <span>Couleur milieu</span>
                    <input
                      type="color"
                      value={gradientMiddle}
                      onChange={(e) => setGradientMiddle(e.target.value)}
                    />
                  </div>
                  <div className="color-picker-row">
                    <span>Couleur bas</span>
                    <input
                      type="color"
                      value={gradientBottom}
                      onChange={(e) => setGradientBottom(e.target.value)}
                    />
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 12 }}>
                    <span>Degré dégradé haut</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={gradientStrength}
                      onChange={(e) => setGradientStrength(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 40, textAlign: "right" }}>
                      {gradientStrength}
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Degré dégradé bas</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={gradientStrength2}
                      onChange={(e) => setGradientStrength2(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: 40, textAlign: "right" }}>
                      {gradientStrength2}
                    </span>
                  </div>
                  <div className="color-picker-row" style={{ marginTop: 8 }}>
                    <span>Positions B / H</span>
                    <div style={{ flex: 1 }}>
                      <DualPositionSlider
                        valueLow={gradientPosition2}
                        valueHigh={gradientPosition}
                        onChange={(low, high) => {
                          setGradientPosition2(low);
                          setGradientPosition(high);
                        }}
                      />
                    </div>
                  </div>
                  {(modelType === "Lure17" ||
                    modelType === "Lure18" ||
                    modelType === "Lure19" ||
                    modelType === "Lure20" ||
                    modelType === "Lure21" ||
                    modelType === "Lure22") && (
                    <div className="color-picker-row" style={{ marginTop: 8 }}>
                      <span>Mask</span>
                      <div className="home-type-filters" style={{ flex: 1 }}>
                        {[
                          { key: "none", label: "Aucun" },
                          { key: "pike", label: "Pike" },
                          { key: "card", label: "Points" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={`home-type-filter-btn${
                              maskType === opt.key ? " home-type-filter-btn--active" : ""
                            }`}
                            onClick={() => setMaskType(opt.key)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="color-picker-row">
                  <span>Couleur</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
              )}
              {modelType === "CollectionTest" && (
                <div className="color-picker-row" style={{ marginTop: 8 }}>
                  <span>Type de palette</span>
                  <div className="home-type-filters" style={{ flex: 1 }}>
                    {["Palette_H", "Palette_M"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`home-type-filter-btn${
                          paletteType === type ? " home-type-filter-btn--active" : ""
                        }`}
                        onClick={() => setPaletteType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <p className="lure-list-message lure-list-message--error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="primary-btn"
                disabled={creating}
                style={{ marginTop: 12, width: "100%" }}
              >
                {creating ? "Création..." : "Sauvegarder"}
              </button>
            </section>
          </form>
        </aside>
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


