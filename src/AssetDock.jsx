import React from "react";

export function AssetDock({
  assetDockHeight,
  setAssetDockHeight,
  assetLibrary,
  setAssetLibrary,
  assetDockTab,
  setAssetDockTab,
  fileInputModelRef,
  handleImportModelFileChange,
  modelType,
  selectedLocalModel,
  setSelectedLocalModelId,
  setModelType,
  localModels,
  setLocalModels,
  selectedAttachAsset,
  selectedAttachId,
  setSelectedAttachId,
  attachSize,
  attachColor,
  builtinAttachSlots,
  bavetteOptions,
  bavetteType,
  setBavetteType,
  bavetteThumbnails,
  setSelectedPart,
  setShowElementPopup,
  selectedBavettePackUrl,
  currentDimensionsCm,
  modelMetadata,
  selectedTexture,
  setSelectedTexture,
  cmToInch,
}) {
  return (
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
              assetDockTab === "palettes" ? " asset-dock-tab-btn--active" : ""
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
                      <div
                        className="model-list model-list--grid-attach"
                        style={{ marginTop: 10 }}
                      >
                        {localModels.map((m) => (
                          <div
                            key={m.id}
                            className={`model-item model-item--attach${
                              selectedLocalModel?.id === m.id
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
                                if (selectedLocalModel?.id === m.id) {
                                  setSelectedLocalModelId(null);
                                }
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
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
                          ? `${cmToInch(
                              currentDimensionsCm.lengthCm,
                            ).toFixed(2)}"`
                          : "—"}
                      </span>
                    </div>
                    <div className="asset-dock-meta-row">
                      <span>Hauteur</span>
                      <span>
                        {currentDimensionsCm?.heightCm != null
                          ? `${cmToInch(
                              currentDimensionsCm.heightCm,
                            ).toFixed(2)}"`
                          : "—"}
                      </span>
                    </div>
                    <div className="asset-dock-meta-row">
                      <span>Largeur</span>
                      <span>
                        {currentDimensionsCm?.widthCm != null
                          ? `${cmToInch(
                              currentDimensionsCm.widthCm,
                            ).toFixed(2)}"`
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
                        Aucun mesh commençant par &quot;Bavette&quot; trouvé
                        dans le pack sélectionné.
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
                                  setShowElementPopup(true);
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
  );
}


