import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
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

export default CreateLurePage;


