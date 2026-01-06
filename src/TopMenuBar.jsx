import React from "react";

export function TopMenuBar({
  openMenu,
  setOpenMenu,
  onOpenSaveDialog,
  onDownloadLureGlb,
  onDownloadAttachGlb,
  onDownloadBavetteGlb,
  hasSelectedAttach,
}) {
  return (
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
                onOpenSaveDialog();
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
                onDownloadLureGlb();
              }}
            >
              Lure (.glb)
            </button>
            <button
              type="button"
              className="top-menu-item"
              disabled={!hasSelectedAttach}
              onClick={() => {
                setOpenMenu(null);
                if (hasSelectedAttach) onDownloadAttachGlb();
              }}
              title={
                hasSelectedAttach
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
                onDownloadBavetteGlb();
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
  );
}


