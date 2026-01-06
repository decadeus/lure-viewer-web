import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  Grid,
  useGLTF,
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";

import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import { AxesWithTicks } from "./AxesOverlay";
import { CreateLureSidebar } from "./CreateLureSidebar";
import { LureModel } from "./LureModel.jsx";
import attachAssetsConfig from "./attachAssets.json";

// Conversion unités : 1 inch = 2.54 cm
const CM_PER_INCH = 2.54;
const cmToInch = (cm) => (cm == null ? null : cm / CM_PER_INCH);
const inchToCm = (inch) => (inch == null ? null : inch * CM_PER_INCH);

// Résolution des chemins statiques (marche en dev et dans l'app desktop)
const staticBase = import.meta.env.BASE_URL || "/";
const resolveStaticPath = (p) => {
  if (!p) return p;
  // Ne pas toucher aux URLs déjà absolues (http, blob, data...)
  if (/^(https?:|blob:|data:)/i.test(p)) return p;
  return `${staticBase}${p.replace(/^\/+/, "")}`;
};

// Mapping des modèles intégrés vers leurs fichiers .glb (même logique que LureModel)
const getBuiltinModelGlbPath = (modelType) => {
  const base = import.meta.env.BASE_URL || "/";
  switch (modelType) {
    case "LurePret5":
      return `${base}models/LurePret7.glb`;
    case "LureDouble":
      return `${base}models/LureDouble.glb`;
    case "Shad":
      return `${base}models/Shad.glb`;
    case "Shad2":
      // Shad2 utilise le fichier final Shad5.glb
      return `${base}models/Shad5.glb`;
    case "LureTop":
      return `${base}models/LureTop.glb`;
    case "LureTop3":
      return `${base}models/LureTop3.glb`;
    case "TEestCubeglb":
      return `${base}models/TEestCubeglb.glb`;
    case "TEestCubeglb2":
      return `${base}models/TEestCubeglb2.glb`;
    default:
      return `${base}models/LurePret7.glb`;
  }
};

// ----------- Page création : choisir le type de leurre -----------

function FreeBavetteMesh({
  pack,
  bavetteType,
  offset,
  rotationDeg,
  onClick,
}) {
  if (!pack?.scene || !bavetteType) return null;
  const source = pack.scene.getObjectByName(bavetteType);
  if (!source) return null;

  const clone = source.clone(true);
  const { x = 0, y = 0, z = 0 } = offset || {};
  const rot = rotationDeg || {};
  clone.position.set(x, y, z);
  clone.rotation.set(
    THREE.MathUtils.degToRad(rot.x || 0),
    THREE.MathUtils.degToRad(rot.y || 0),
    THREE.MathUtils.degToRad(rot.z || 0),
  );
  clone.updateMatrixWorld(true);

  return <primitive object={clone} onClick={onClick} />;
}

function AttachMesh({
  asset,
  offset,
  rotationDeg,
  sizeKey = "#8",
  colorKey = "black",
  onClick,
}) {
  if (!asset) return null;
  const gltf = useGLTF(asset.path);
  const scene = gltf?.scene;
  if (!scene) return null;

  const clone = useMemo(() => {
    const c = scene.clone(true);
    // Normaliser l'attach : le recentrer et lui donner une taille raisonnable
    const box = new THREE.Box3().setFromObject(c);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    c.position.sub(center); // centre sur l'origine
    const targetSize = 0.4; // taille de base (~taille #8, 10–11 mm)
    const baseScale = targetSize / maxDim;
    c.scale.multiplyScalar(baseScale);

    // Facteur de taille relatif par rapport au #8 (référence 10–11 mm)
    const sizeFactor =
      sizeKey === "#10"
        ? 0.85
        : sizeKey === "#6"
          ? 1.3
          : sizeKey === "#4"
            ? 1.7
            : sizeKey === "#2"
              ? 2.0
              : 1.0; // "#8" ou valeur inconnue → référence
    c.scale.multiplyScalar(sizeFactor);

    // Couleur du métal selon le choix (noir / doré / gris)
    const color =
      colorKey === "gold"
        ? new THREE.Color("#d4af37")
        : colorKey === "grey"
          ? new THREE.Color("#9ca3af")
          : new THREE.Color("#111827");
    c.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.material) return;
      const mat = child.material;
      if (mat.color) mat.color.copy(color);
      mat.metalness = 0.7;
      mat.roughness = 0.35;
    });
    c.updateMatrixWorld(true);
    return c;
  }, [scene, asset.id, sizeKey, colorKey]);
  const { x = 0, y = 0, z = 0 } = offset || {};
  const rot = rotationDeg || {};
  clone.position.set(x, y, z);
  clone.rotation.set(
    THREE.MathUtils.degToRad(rot.x || 0),
    THREE.MathUtils.degToRad(rot.y || 0),
    THREE.MathUtils.degToRad(rot.z || 0),
  );
  clone.updateMatrixWorld(true);

  return <primitive object={clone} onClick={onClick} />;
}

function CreateLurePage() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [modelType, setModelType] = useState("LurePret5");
  // Couleur de base du leurre : blanc neutre (plus lisible que le rouge foncé par défaut)
  const [color, setColor] = useState("#ffffff");
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
  const fileInputModelRef = useRef(null);
  const [currentDimensionsCm, setCurrentDimensionsCm] = useState(null);
  const [showAxes, setShowAxes] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [viewMode, setViewMode] = useState("axes"); // "lure-only" | "axes" | "image-bg"
  const [visibleParts, setVisibleParts] = useState({
    lure: true,
    bavette: true,
    attach: true,
    eyes: true,
  });
  const [modelMetadata, setModelMetadata] = useState(null);

  // Tailles physiques en inch définies dans Blender (Custom Property SizesInch)
  const customSizesInch = useMemo(() => {
    const raw = modelMetadata?.sizesInchRaw;
    if (!raw) return null;

    let parts = [];
    if (typeof raw === "string") {
      parts = raw
        .split(/[,;\/ ]+/)
        .map((s) => Number(s.trim()));
    } else if (Array.isArray(raw)) {
      parts = raw.map((n) => Number(n));
    } else {
      return null;
    }

    parts = parts.filter((n) => Number.isFinite(n) && n > 0);
    if (!parts.length) return null;
    // On supprime les doublons et on trie croissant
    const uniq = Array.from(new Set(parts)).sort((a, b) => a - b);
    return uniq;
  }, [modelMetadata]);

  const [selectedSizeInch, setSelectedSizeInch] = useState(null);

  useEffect(() => {
    if (customSizesInch && customSizesInch.length > 0) {
      // Taille par défaut = première valeur déclarée
      setSelectedSizeInch((prev) => (prev == null ? customSizesInch[0] : prev));
    } else {
      setSelectedSizeInch(null);
    }
  }, [customSizesInch]);

  // ----------- Téléchargements (.glb) -----------

  const triggerDownload = (url, filename) => {
    if (!url) return;
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Erreur téléchargement", err);
    }
  };

  const handleDownloadLureGlb = () => {
    const url =
      selectedLocalModel?.url || getBuiltinModelGlbPath(modelType || "LurePret5");
    const name =
      selectedLocalModel?.name
        ? `${selectedLocalModel.name}.glb`
        : `${modelType || "Lure"}.glb`;
    triggerDownload(url, name);
  };

  const handleDownloadAttachGlb = () => {
    if (!selectedAttachAsset) return;
    const url = selectedAttachAsset.path;
    const baseName =
      selectedAttachAsset.file || selectedAttachAsset.id || "Attach";
    const name = baseName.toLowerCase().endsWith(".glb")
      ? baseName
      : `${baseName}.glb`;
    triggerDownload(url, name);
  };

  const handleDownloadBavetteGlb = () => {
    const url = bavettePackPathForList;
    if (!url) return;
    const name = selectedBavettePackUrl
      ? "Bavettes_locales.glb"
      : "Pack_Bavette7.glb";
    triggerDownload(url, name);
  };

  // Import d'un modèle .glb depuis le disque
  const handleImportModelFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      // eslint-disable-next-line no-alert
      alert("Merci de choisir un fichier .glb");
      event.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    const id = `local-${Date.now()}-${file.name}`;
    const name = file.name.replace(/\.glb$/i, "");
    setLocalModels((prev) => [...prev, { id, name, url }]);
    setSelectedLocalModelId(id);
    setModelType("Custom");
    event.target.value = "";
  };

  // Met à jour la couleur de fond réelle du canvas (opaque ou transparente
  // pour laisser apparaître l'image BGLure.png derrière).
  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    if (viewMode === "image-bg") {
      // transparent -> fond géré par CSS (.app-root--dark avec BGLure.png)
      gl.setClearColor(0x000000, 0);
    } else {
      // fond sombre opaque façon Blender
      gl.setClearColor("#18181b", 1);
    }
  }, [viewMode]);
  // Pack de bavettes sélectionné
  // - null => pack intégré (models/Pack_Bavette7.glb)
  // - url blob:... => pack importé localement
  const [selectedBavettePackUrl, setSelectedBavettePackUrl] = useState(null);
  const [localBavettePacks, setLocalBavettePacks] = useState([]);
  // Indique si le modèle courant possède un socket de bavette (ex: A-Bav)
  const [hasBavetteSocket, setHasBavetteSocket] = useState(false);
  // Onglet actif dans la colonne de droite (Ta / T / Bv / Tx / C / Yeux / Ax)
  const [activeToolTab, setActiveToolTab] = useState("size");
  // Barre d'assets en bas (façon Blender)
  const [assetDockTab, setAssetDockTab] = useState("models"); // "models" | "textures" | "bavettes" | "palettes" | "attach" | "hooks"
  const [assetLibrary, setAssetLibrary] = useState("integree"); // "integree" | "vide"
  const [assetDockOpen, setAssetDockOpen] = useState(true);
  const [assetDockHeight, setAssetDockHeight] = useState(220);
  const [textureLibrary, setTextureLibrary] = useState("builtin"); // "builtin" | "local"
  const [bavetteThumbnails, setBavetteThumbnails] = useState({});
  // Position / rotation manuelles de la bavette libre
  const [bavetteOffset, setBavetteOffset] = useState({ x: -0.4, y: -0.3, z: 0 });
  const [bavetteRotation, setBavetteRotation] = useState({ x: 0, y: 0, z: 0 }); // en degrés
  const [showElementPopup, setShowElementPopup] = useState(false);
  const [selectedPart, setSelectedPart] = useState("body"); // "body" | "eyes" | "bavette" | ...
  const [openMenu, setOpenMenu] = useState(null); // "files" | "download" | "help" | null
  const [selectedAttachId, setSelectedAttachId] = useState(null);
  const [attachSize, setAttachSize] = useState("#8"); // #10, #8, #6, #4, #2
  const [attachColor, setAttachColor] = useState("black"); // "black" | "gold" | "grey"
  const [attachOffset, setAttachOffset] = useState(null); // défini au moment de la sélection
  const [attachRotation, setAttachRotation] = useState({ x: 0, y: 0, z: 0 }); // en degrés

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

  const builtinAttachAssets = useMemo(
    () =>
      (attachAssetsConfig || []).map((asset) => ({
        ...asset,
        path: resolveStaticPath(`Attach/${asset.file}`),
        imagePath: asset.image ? resolveStaticPath(asset.image) : null,
      })),
    [],
  );

  // Pour l'affichage façon Asset Browser : compléter la dernière rangée
  // avec des emplacements vides afin de toujours montrer la grille complète.
  const builtinAttachSlots = useMemo(() => {
    const cols = 8;
    const count = builtinAttachAssets.length;
    const totalSlots = Math.max(cols, Math.ceil(count / cols) * cols);
    return Array.from({ length: totalSlots }, (_, i) =>
      i < count ? builtinAttachAssets[i] : null,
    );
  }, [builtinAttachAssets]);

  const selectedAttachAsset = useMemo(
    () => builtinAttachAssets.find((a) => a.id === selectedAttachId) || null,
    [builtinAttachAssets, selectedAttachId],
  );

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
        error: createError,
      } = await supabase
        .from("lures")
        .insert(payload)
        .select()
        .single();

      if (createError) {
        // eslint-disable-next-line no-console
        console.error("Erreur création leurre", createError);
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
            // eslint-disable-next-line no-console
            console.error("Erreur upload thumbnail", uploadError);
          }
        } catch (thumbErr) {
          // eslint-disable-next-line no-console
          console.error("Erreur génération thumbnail", thumbErr);
        }
      }

      navigate("/");
    } finally {
      setCreating(false);
    }
  };

  // Quand une bavette est sélectionnée (depuis le dock du bas ou la sidebar),
  // on la recentre légèrement sous le leurre avec un offset par défaut
  // et on affiche la petite fenêtre de réglage.
  useEffect(() => {
    if (bavetteType && bavettePackGltfForList?.scene) {
      setBavetteOffset({ x: -0.4, y: -0.3, z: 0 });
      setBavetteRotation({ x: 0, y: 0, z: 0 });
      setShowElementPopup(true);
    }
  }, [bavetteType, bavettePackGltfForList]);

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
      <div className="top-menu-bar">
        <div className="top-menu-group">
          <button
            type="button"
            className="top-menu-root"
            onClick={() =>
              setOpenMenu((prev) => (prev === "files" ? null : "files"))
            }
          >
            Files
          </button>
          {openMenu === "files" && (
            <div className="top-menu-dropdown">
              <button
                type="button"
                className="top-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  if (typeof document !== "undefined") {
                    const form = document.getElementById("create-lure-form");
                    if (form?.requestSubmit) form.requestSubmit();
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="top-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  setSaveDialogOpen(true);
                }}
              >
                Save as…
              </button>
              <button
                type="button"
                className="top-menu-item"
                disabled
                title="Export .glb à venir"
              >
                Export to .glb
              </button>
            </div>
          )}
        </div>
        <div className="top-menu-group">
          <button
            type="button"
            className="top-menu-root"
            onClick={() =>
              setOpenMenu((prev) => (prev === "download" ? null : "download"))
            }
          >
            Download
          </button>
          {openMenu === "download" && (
            <div className="top-menu-dropdown">
              <button
                type="button"
                className="top-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  handleDownloadLureGlb();
                }}
              >
                Lure (.glb)
              </button>
              <button
                type="button"
                className="top-menu-item"
                disabled={!selectedAttachAsset}
                onClick={() => {
                  setOpenMenu(null);
                  handleDownloadAttachGlb();
                }}
                title={
                  selectedAttachAsset
                    ? "Télécharger l'attach sélectionné en .glb"
                    : "Sélectionnez une attach dans la barre du bas"
                }
              >
                Attach (.glb)
              </button>
              <button
                type="button"
                className="top-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  handleDownloadBavetteGlb();
                }}
              >
                Bavettes pack (.glb)
              </button>
            </div>
          )}
        </div>
        <div className="top-menu-group">
          <button
            type="button"
            className="top-menu-root"
            onClick={() =>
              setOpenMenu((prev) => (prev === "help" ? null : "help"))
            }
          >
            Help
          </button>
          {openMenu === "help" && (
            <div className="top-menu-dropdown">
              <button
                type="button"
                className="top-menu-item"
                disabled
                title="Aide à venir"
              >
                Help
              </button>
            </div>
          )}
        </div>
      </div>
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
            gl={{ preserveDrawingBuffer: true, alpha: true }}
            onCreated={({ gl }) => {
              glRef.current = gl;
            }}
          >
            {/* Grille uniquement en mode "axes" */}
            {viewMode === "axes" && (
              <Grid
                infiniteGrid
                cellSize={0.1}
                sectionSize={1}
                cellThickness={0.3}
                sectionThickness={0.6}
                cellColor="#ffffff"
                sectionColor="#ffffff"
                position={[0, -0.001, 0]}
              />
            )}

            {/* Éclairage neutre */}
            <ambientLight intensity={0.4} />
            <directionalLight position={[2, 5, 3]} intensity={1.5} />
            <directionalLight position={[-2, -3, -2]} intensity={0.8} />
            <pointLight position={[0, 2, 2]} intensity={0.9} />
            {/* HDRI pour l'éclairage (on laisse le fond à CSS pour le mode image) */}
            <Environment preset="sunset" background={false} />
            {/* Bavette libre affichée avec un offset / angle contrôlés par la popup */}
            {bavetteType && (
              <FreeBavetteMesh
                pack={bavettePackGltfForList}
                bavetteType={bavetteType}
                offset={bavetteOffset}
                rotationDeg={bavetteRotation}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowElementPopup(true);
                  setActiveToolTab("bavette");
                  setSelectedPart("bavette");
                }}
              />
            )}
            {/* Attach libre (anneaux / accessoires) avec offset / rotation dans la sidebar */}
            {selectedAttachAsset && visibleParts.attach && (
              <AttachMesh
                asset={selectedAttachAsset}
                offset={attachOffset}
                rotationDeg={attachRotation}
                sizeKey={attachSize}
                colorKey={attachColor}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPart("attach");
                  setShowElementPopup(true);
                }}
              />
            )}
            {visibleParts.lure && (
              <LureModel
                modelType={modelType}
                modelUrl={selectedLocalModel?.url || null}
                color={color}
                // On active systématiquement le dégradé 3 couleurs pour tous les modèles.
                useGradient
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
              bavetteType={visibleParts.bavette ? bavetteType : null}
              // Pack de bavettes actuellement sélectionné (intégré ou importé)
              bavettePackUrl={selectedBavettePackUrl}
              eyeWhiteColor={eyeWhiteColor}
              eyeIrisColor={eyeIrisColor}
              eyeGlowColor={eyeGlowColor}
              eyeGlowStrength={eyeGlowStrength}
              showEyes={visibleParts.eyes}
              lureSize={lureSize}
              sizePresetsInch={customSizesInch}
              selectedSizeInch={selectedSizeInch}
              onComputedDimensionsCm={setCurrentDimensionsCm}
              onHasBavetteSocketChange={setHasBavetteSocket}
              onModelMetadataChange={setModelMetadata}
              selectedPart={selectedPart}
              onBodyClick={() => {
                setActiveToolTab("textures");
                setSelectedPart("body");
              }}
              onEyesClick={() => {
                setActiveToolTab("eyes");
                setSelectedPart("eyes");
              }}
            />
            )}
            {/* Axes mondes X/Y/Z avec petits traits et graduations,
                rassemblés dans un composant dédié (optionnel via showAxes) */}
            {showAxes && !previewMode && (
              <AxesWithTicks
                // On convertit les axes internes (cm) en inches pour l'affichage
                worldPerCm={
                  currentDimensionsCm?.worldPerCm
                    ? currentDimensionsCm.worldPerCm * CM_PER_INCH
                    : 1
                }
                lengthCm={
                  currentDimensionsCm?.lengthCm != null
                    ? cmToInch(currentDimensionsCm.lengthCm)
                    : null
                }
              />
            )}
            {/* Gizmo d'orientation standard de drei (clicable) */}
            {!previewMode && (
              <GizmoHelper alignment="top-right" margin={[280, 80]}>
                <GizmoViewport
                  axisColors={["#ef4444", "#3b82f6", "#22c55e"]}
                  labelColor="#e5e7eb"
                />
              </GizmoHelper>
            )}
            <OrbitControls
              enablePan={false}
              enableZoom
              target={[0, 0, 0]}
            />
          </Canvas>

          {/* Petite légende d'axes façon Blender (Z en haut, Y en profondeur),
              purement visuelle, superposée au gizmo standard. */}
          {!previewMode && (
            <div className="axis-legend">
              <span className="axis-legend-item axis-legend-item--x">X</span>
              <span className="axis-legend-item axis-legend-item--z">Z</span>
              <span className="axis-legend-item axis-legend-item--y">Y</span>
            </div>
          )}

          {/* Bouton "œil" en haut à gauche pour basculer en mode aperçu
              (masque les axes, gizmo, fenêtre Bavette, etc.) */}
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              width: 32,
              height: 32,
              borderRadius: 9999,
              border: "1px solid rgba(156,163,175,0.6)",
              background: previewMode ? "rgba(31,41,55,0.95)" : "rgba(17,24,39,0.9)",
              color: "#e5e7eb",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
              zIndex: 15,
            }}
            title={previewMode ? "Afficher les repères" : "Masquer les repères"}
          >
            {previewMode ? "👁‍🗨" : "👁"}
          </button>

          {/* Sélecteur de mode de vue, vertical sous l'icône œil */}
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              zIndex: 14,
            }}
          >
            {/* 1) Leurres seuls */}
            <button
              type="button"
              onClick={() => setViewMode("lure-only")}
              title="Vue leurre seul"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                border:
                  viewMode === "lure-only"
                    ? "2px solid var(--accent-selected-bg)"
                    : "1px solid rgba(156,163,175,0.6)",
                background:
                  viewMode === "lure-only"
                    ? "rgba(17,24,39,0.95)"
                    : "rgba(17,24,39,0.6)",
                color: "#e5e7eb",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ○
            </button>

            {/* 2) Grille + axes */}
            <button
              type="button"
              onClick={() => setViewMode("axes")}
              title="Vue avec axes / quadrillage"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                border:
                  viewMode === "axes"
                    ? "2px solid var(--accent-selected-bg)"
                    : "1px solid rgba(156,163,175,0.6)",
                background:
                  viewMode === "axes"
                    ? "rgba(17,24,39,0.95)"
                    : "rgba(17,24,39,0.6)",
                color: "#e5e7eb",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ⊕
            </button>

            {/* 3) Image de fond */}
            <button
              type="button"
              onClick={() => setViewMode("image-bg")}
              title="Vue avec image de fond"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                border:
                  viewMode === "image-bg"
                    ? "2px solid var(--accent-selected-bg)"
                    : "1px solid rgba(156,163,175,0.6)",
                background:
                  viewMode === "image-bg"
                    ? "rgba(17,24,39,0.95)"
                    : "rgba(17,24,39,0.6)",
                color: "#e5e7eb",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ●
            </button>
          </div>

          {/* Petite fenêtre de réglage (Location / Rotation) dépendant de l'élément
              sélectionné dans "Éléments du leurre" : Bavette / Attach / Palettes / Hooks */}
          {showElementPopup &&
            !previewMode &&
            (selectedPart === "bavette" ||
              selectedPart === "attach" ||
              selectedPart === "palettes" ||
              selectedPart === "hooks") && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(17,24,39,0.9)",
                color: "#e5e7eb",
                fontSize: 12,
                minWidth: 180,
                boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <strong>
                  {selectedPart === "bavette" && bavetteType
                    ? `Bavette (${bavetteType})`
                    : selectedPart === "attach"
                      ? "Attach"
                      : selectedPart === "palettes"
                        ? "Palettes"
                        : "Hooks"}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    setShowElementPopup(false);
                    setSelectedPart("body");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Location:</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 4 }}>X (in)</span>
                <input
                  type="number"
                  value={
                    currentDimensionsCm?.worldPerCm
                      ? (
                          ((selectedPart === "attach"
                            ? attachOffset?.x || 0
                            : bavetteOffset.x || 0) /
                          currentDimensionsCm.worldPerCm /
                          CM_PER_INCH)
                        ).toFixed(2)
                      : selectedPart === "attach"
                        ? attachOffset?.x || 0
                        : bavetteOffset.x
                  }
                  step={0.1}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    const cm = inchToCm(inches);
                    const worldPerCm = currentDimensionsCm?.worldPerCm || 1;
                    if (selectedPart === "attach") {
                      setAttachOffset((prev) => ({
                        ...(prev || {}),
                        x: cm * worldPerCm,
                      }));
                    } else {
                      setBavetteOffset((prev) => ({
                        ...prev,
                        x: cm * worldPerCm,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 4 }}>Y (in)</span>
                <input
                  type="number"
                  value={
                    currentDimensionsCm?.worldPerCm
                      ? (
                          ((selectedPart === "attach"
                            ? attachOffset?.y || 0
                            : bavetteOffset.y || 0) /
                          currentDimensionsCm.worldPerCm /
                          CM_PER_INCH)
                        ).toFixed(2)
                      : selectedPart === "attach"
                        ? attachOffset?.y || 0
                        : bavetteOffset.y
                  }
                  step={0.1}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    const cm = inchToCm(inches);
                    const worldPerCm = currentDimensionsCm?.worldPerCm || 1;
                    if (selectedPart === "attach") {
                      setAttachOffset((prev) => ({
                        ...(prev || {}),
                        y: cm * worldPerCm,
                      }));
                    } else {
                      setBavetteOffset((prev) => ({
                        ...prev,
                        y: cm * worldPerCm,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 4 }}>Z (in)</span>
                <input
                  type="number"
                  value={
                    currentDimensionsCm?.worldPerCm
                      ? (
                          ((selectedPart === "attach"
                            ? attachOffset?.z || 0
                            : bavetteOffset.z || 0) /
                          currentDimensionsCm.worldPerCm /
                          CM_PER_INCH)
                        ).toFixed(2)
                      : selectedPart === "attach"
                        ? attachOffset?.z || 0
                        : bavetteOffset.z
                  }
                  step={0.1}
                  onChange={(e) => {
                    const inches = Number(e.target.value);
                    const cm = inchToCm(inches);
                    const worldPerCm = currentDimensionsCm?.worldPerCm || 1;
                    if (selectedPart === "attach") {
                      setAttachOffset((prev) => ({
                        ...(prev || {}),
                        z: cm * worldPerCm,
                      }));
                    } else {
                      setBavetteOffset((prev) => ({
                        ...prev,
                        z: cm * worldPerCm,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
              <div style={{ fontWeight: 600, margin: "6px 0 2px" }}>
                Rotation:
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 4 }}>X (°)</span>
                <input
                  type="number"
                  value={
                    selectedPart === "attach"
                      ? attachRotation?.x ?? 0
                      : bavetteRotation.x
                  }
                  step={1}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const deg = ((raw % 360) + 360) % 360;
                    if (selectedPart === "attach") {
                      setAttachRotation((prev) => ({
                        ...(prev || {}),
                        x: deg,
                      }));
                    } else {
                      setBavetteRotation((prev) => ({
                        ...prev,
                        x: deg,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ marginRight: 4 }}>Y (°)</span>
                <input
                  type="number"
                  value={
                    selectedPart === "attach"
                      ? attachRotation?.y ?? 0
                      : bavetteRotation.y
                  }
                  step={1}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const deg = ((raw % 360) + 360) % 360;
                    if (selectedPart === "attach") {
                      setAttachRotation((prev) => ({
                        ...(prev || {}),
                        y: deg,
                      }));
                    } else {
                      setBavetteRotation((prev) => ({
                        ...prev,
                        y: deg,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
              <div>
                <span style={{ marginRight: 4 }}>Z (°)</span>
                <input
                  type="number"
                  value={
                    selectedPart === "attach"
                      ? attachRotation?.z ?? 0
                      : bavetteRotation.z
                  }
                  step={1}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const deg = ((raw % 360) + 360) % 360;
                    if (selectedPart === "attach") {
                      setAttachRotation((prev) => ({
                        ...(prev || {}),
                        z: deg,
                      }));
                    } else {
                      setBavetteRotation((prev) => ({
                        ...prev,
                        z: deg,
                      }));
                    }
                  }}
                  style={{ width: "60%", fontSize: 11 }}
                />
              </div>
            </div>
          )}

          {/* Panneau extensible façon Blender (menu en haut + contenu en dessous) */}
          {assetDockOpen && !previewMode && (
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

              {/* Barre de sélection de bibliothèque (All Libraries / Intégrée / Vide) */}
              <div className="asset-dock-library-bar">
                <span className="asset-dock-library-label">All Libraries</span>
                <select
                  className="asset-dock-library-select"
                  value={assetLibrary}
                  onChange={(e) => setAssetLibrary(e.target.value)}
                >
                  <option value="integree">Intégrée</option>
                  <option value="vide">Vide</option>
                </select>
              </div>

              {/* Panneau d'assets façon Blender : menu vertical */}
              <div className="asset-dock-main asset-dock-main--with-sidebar">
                {/* Menu vertical à gauche */}
                <div className="asset-dock-vertical-menu">
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
                      assetDockTab === "attach" ? " asset-dock-tab-btn--active" : ""
                    }`}
                    onClick={() => setAssetDockTab("attach")}
                  >
                    Attach
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
                  <button
                    type="button"
                    className={`asset-dock-tab-btn${
                      assetDockTab === "palettes"
                        ? " asset-dock-tab-btn--active"
                        : ""
                    }`}
                    onClick={() => setAssetDockTab("palettes")}
                  >
                    Palettes
                  </button>
                  <button
                    type="button"
                    className={`asset-dock-tab-btn${
                      assetDockTab === "hooks" ? " asset-dock-tab-btn--active" : ""
                    }`}
                    onClick={() => setAssetDockTab("hooks")}
                  >
                    Hooks
                  </button>
                </div>

                {/* Contenu de la bibliothèque (à droite) */}
                <div className="asset-dock-vertical-content">
                  {assetLibrary === "vide" ? (
                    <p className="asset-dock-empty-text">
                      Cette bibliothèque est vide pour l&apos;instant.
                    </p>
                  ) : (
                    <>
                {assetDockTab === "models" && (
                  <div className="asset-dock-row asset-dock-row--split">
                    <div className="asset-dock-items">
                      {/* Modèles intégrés + case spéciale "Importer .glb" */}
                      <div className="model-list model-list--grid-attach">
                        {/* Case d'import .glb depuis le disque, en première position */}
                        <button
                          type="button"
                          className="model-item model-item--attach"
                          onClick={() => fileInputModelRef.current?.click()}
                        >
                          <div className="model-thumb model-thumb--placeholder">
                            ↓
                          </div>
                          <div className="model-name">Importer (.glb)</div>
                        </button>
                        <input
                          ref={fileInputModelRef}
                          type="file"
                          accept=".glb,model/gltf-binary"
                          style={{ display: "none" }}
                          onChange={handleImportModelFileChange}
                        />

                        {[
                          "LurePret5",
                          "LureDouble",
                          "Shad",
                          "Shad2",
                          "LureTop",
                          "LureTop3",
                          "TEestCubeglb",
                          "TEestCubeglb2",
                          "TEestCubeglb14",
                        ].map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`model-item model-item--attach${
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
                          <div
                            className="model-list model-list--grid-attach"
                            style={{ marginTop: 10 }}
                          >
                            {localModels.map((m) => (
                              <div
                                key={m.id}
                              className={`model-item model-item--attach${
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
                      <div className="asset-dock-meta-row">
                        <span>Longueur</span>
                        <span>
                          {currentDimensionsCm?.lengthCm != null
                            ? `${cmToInch(currentDimensionsCm.lengthCm).toFixed(2)}"`
                            : "—"}
                        </span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Hauteur</span>
                        <span>
                          {currentDimensionsCm?.heightCm != null
                            ? `${cmToInch(currentDimensionsCm.heightCm).toFixed(2)}"`
                            : "—"}
                        </span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Largeur</span>
                        <span>
                          {currentDimensionsCm?.widthCm != null
                            ? `${cmToInch(currentDimensionsCm.widthCm).toFixed(2)}"`
                            : "—"}
                        </span>
                      </div>
                      <div className="asset-dock-meta-row asset-dock-meta-row--description">
                        <span>Description</span>
                        <span>{modelMetadata?.description || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {assetDockTab === "textures" && (
                  <div className="asset-dock-row asset-dock-row--split">
                    <div className="asset-dock-items">
                      <div className="model-list model-list--grid-attach">
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
                            className={`model-item model-item--attach${
                              selectedTexture === tex.key
                                ? " model-item--active"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedTexture((current) =>
                                current === tex.key ? null : tex.key,
                              )
                            }
                          >
                            <div className="model-thumb texture-thumb--pike" />
                            <div className="model-name">{tex.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="asset-dock-meta">
                      <h3 className="asset-dock-meta-title">Infos texture</h3>
                      <div className="asset-dock-meta-row">
                        <span>Chemin</span>
                        <span>{selectedTexture || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {assetDockTab === "bavettes" && (
                  <div className="asset-dock-row asset-dock-row--split">
                    <div className="asset-dock-items">
                      {bavetteOptions && bavetteOptions.length > 0 ? (
                        <div className="model-list model-list--grid-attach">
                          {bavetteOptions.map((opt) =>
                            opt.key === null ? null : (
                              <button
                                key={opt.key}
                                type="button"
                                className={`model-item model-item--attach${
                                  bavetteType === opt.key
                                    ? " bavette-card--active"
                                    : ""
                                }`}
                                onClick={() => {
                                  setBavetteType((current) =>
                                    current === opt.key ? null : opt.key,
                                  );
                                  if (opt.key) {
                                    setSelectedPart("bavette");
                                    setShowElementPopup(true);
                                  }
                                }}
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
                    <div className="asset-dock-meta">
                      <h3 className="asset-dock-meta-title">Infos bavette</h3>
                      <div className="asset-dock-meta-row">
                        <span>Nom</span>
                        <span>{bavetteType || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Pack</span>
                        <span>
                          {selectedBavettePackUrl
                            ? "Pack local"
                            : "Pack intégré (Pack_Bavette7)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {assetDockTab === "palettes" && (
                  <div className="asset-dock-row">
                    <p className="asset-dock-empty-text">
                      Palettes: sélection et gestion à venir.
                    </p>
                  </div>
                )}
                {assetDockTab === "attach" && (
                  <div className="asset-dock-row asset-dock-row--split">
                    <div className="asset-dock-items asset-dock-items--attach">
                      <div className="model-list model-list--grid-attach">
                        {builtinAttachSlots.map((att, index) =>
                          att ? (
                            <button
                              key={att.id}
                              type="button"
                              className={`model-item model-item--attach${
                                selectedAttachId === att.id
                                  ? " model-item--active"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedAttachId((prev) => {
                                  const next = prev === att.id ? null : att.id;
                                  if (next) {
                                    // première sélection -> initialiser position/rotation
                                    setAttachOffset((o) => o || { x: 0, y: 0, z: 0 });
                                    setAttachRotation((r) => r || { x: 0, y: 0, z: 0 });
                                    setSelectedPart("attach");
                                  } else {
                                    // désélection -> cacher Attach
                                    setSelectedPart("body");
                                  }
                                  return next;
                                });
                              }}
                            >
                              {att.imagePath ? (
                                <img
                                  src={att.imagePath}
                                  alt={att.name}
                                  className="model-thumb"
                                />
                              ) : (
                                <div className="model-thumb model-thumb--placeholder">
                                  {att.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="model-name">{att.name}</div>
                            </button>
                          ) : (
                            <div
                              key={`attach-empty-${index}`}
                              className="model-item model-item--attach model-item--attach-empty"
                            >
                              <div className="model-thumb model-thumb--empty" />
                              <div className="model-name">&nbsp;</div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="asset-dock-meta">
                      <h3 className="asset-dock-meta-title">Infos attach</h3>
                      <div className="asset-dock-meta-row">
                        <span>Nom</span>
                        <span>{selectedAttachAsset?.name || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Taille</span>
                        <span>{attachSize || "—"}</span>
                      </div>
                      <div className="asset-dock-meta-row">
                        <span>Couleur</span>
                        <span>{attachColor || "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {assetDockTab === "hooks" && (
                  <div className="asset-dock-row">
                    <p className="asset-dock-empty-text">
                      Hooks: futurs triples / hameçons à venir.
                    </p>
                  </div>
                )}
                    </>
                  )}
                </div>
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
          bavetteOffset={bavetteOffset}
          setBavetteOffset={setBavetteOffset}
          bavetteAngle={bavetteRotation.z}
          setBavetteAngle={(val) => {
            const raw = Number(val);
            const deg = ((raw % 360) + 360) % 360;
            setBavetteRotation((prev) => ({ ...prev, z: deg }));
          }}
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
          visibleParts={visibleParts}
          setVisibleParts={setVisibleParts}
          error={error}
          creating={creating}
          onSubmit={handleSubmit}
          onLogout={() => supabase.auth.signOut()}
          hidden={previewMode}
          selectedPart={selectedPart}
          onSelectPart={(part) => {
            setSelectedPart(part);
            if (
              part === "bavette" ||
              part === "attach" ||
              part === "palettes" ||
              part === "hooks"
            ) {
              setShowElementPopup(true);
            } else {
              setShowElementPopup(false);
            }
          }}
          attachOffset={attachOffset}
          setAttachOffset={setAttachOffset}
          attachRotation={attachRotation}
          setAttachRotation={setAttachRotation}
          worldPerCm={currentDimensionsCm?.worldPerCm || 1}
          attachSize={attachSize}
          setAttachSize={setAttachSize}
          attachColor={attachColor}
          setAttachColor={setAttachColor}
          sizePresetsInch={customSizesInch}
          selectedSizeInch={selectedSizeInch}
          setSelectedSizeInch={setSelectedSizeInch}
        />
      </div>
    </div>
  );
}

export default CreateLurePage;



