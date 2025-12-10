import * as THREE from "three";

/**
 * Attache dynamiquement une palette (PalettesV5.glb) sur un socket d'un leurre.
 *
 * Hypothèses côté GLTF :
 * - Fichier : public/Palettes/PalettesV5.glb
 * - Pour chaque type de palette (H / M / L), il existe un Empty d'attache dédié :
 *   Palette_Attach_H / Palette_Attach_M / Palette_Attach_L (ou variantes proches).
 *
 * Cette fonction est calquée sur `attachTripleToLure` :
 * - nettoie d'abord les anciennes palettes déjà attachées sur le socket,
 * - clone la scène des palettes,
 * - trouve l'Empty correspondant à la variante choisie (H/M/L),
 * - garde visibles uniquement les quelques meshes les plus proches
 *   de cet Empty (le "cluster" de la palette),
 * - recentre le groupe sur cet Empty,
 * - et attache le groupe au socket demandé.
 */
export function attachPaletteToLure({
  scene,
  palettesGltf,
  paletteName,
  socketName = "Attach_Back_Add",
  lureScale = 1,
}) {
  if (!scene || !palettesGltf?.scene) return;

  const socket = scene.getObjectByName(socketName);
  if (!socket) return;

  // Supprimer toute ancienne palette déjà attachée
  socket.children
    .slice()
    .forEach((child) => {
      if (child.userData?.isAttachedPalette) {
        socket.remove(child);
      }
    });

  // Si aucune palette demandée, on nettoie juste le socket
  if (!paletteName) {
    return;
  }

  const paletteRoot = palettesGltf.scene.clone(true);

  // Compenser la taille globale du leurre :
  // si le leurre est agrandi (L / XL), on réduit
  // la palette pour qu'elle garde une taille monde constante.
  const scaleFactor =
    Number.isFinite(lureScale) && lureScale > 0 ? lureScale : 1;
  if (scaleFactor !== 1) {
    paletteRoot.scale.multiplyScalar(1 / scaleFactor);
  }

  const variantKeys = ["Palette_H", "Palette_M", "Palette_L"];
  const defaultVariantKey = "Palette_M";
  const selectedKey = variantKeys.includes(paletteName)
    ? paletteName
    : defaultVariantKey;

  // 1) Trouver l'Empty d'attache correspondant à la taille choisie
  const attachNameByVariant = {
    Palette_H: ["Palette_Attach_H"],
    Palette_M: ["Palette_Attach_M"],
    Palette_L: ["Palette_Attach_L"],
  };

  const wantedNames = attachNameByVariant[selectedKey] || [];
  let attachMarker = null;
  paletteRoot.traverse((child) => {
    if (!child.name || attachMarker) return;
    if (
      wantedNames.includes(child.name) ||
      wantedNames.some((base) => child.name.startsWith(base))
    ) {
      attachMarker = child;
    }
  });

  if (!attachMarker) {
    // eslint-disable-next-line no-console
    console.warn("attachPaletteToLure: attachMarker NOT found", {
      paletteName,
      selectedKey,
      wantedNames,
    });
    return;
  }

  // 2) Calculer la position monde de l'Empty d'attache
  paletteRoot.updateWorldMatrix(true, true);
  attachMarker.updateWorldMatrix(true, true);
  const refWorldPos = new THREE.Vector3();
  attachMarker.getWorldPosition(refWorldPos);

  // 3) Lister tous les meshes et calculer leur distance à cet Empty
  const meshCandidates = [];
  paletteRoot.traverse((child) => {
    if (!child.isMesh) return;
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    const dist = worldPos.distanceTo(refWorldPos);
    meshCandidates.push({ mesh: child, dist });
  });

  // 4) Garder visibles uniquement les 5 meshes les plus proches
  meshCandidates.sort((a, b) => a.dist - b.dist);
  const keepCount = Math.min(5, meshCandidates.length);
  meshCandidates.forEach((entry, index) => {
    entry.mesh.visible = index < keepCount;
  });

  // 5) Recentrer toute la scène sur l'Empty d'attache (origine locale)
  attachMarker.updateWorldMatrix(false, false);
  const attachPosLocal = attachMarker.position.clone();
  paletteRoot.position.sub(attachPosLocal);

  // 6) Cloner les matériaux pour éviter les effets de bord entre instances
  paletteRoot.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
    }
  });

  paletteRoot.userData = {
    ...(paletteRoot.userData || {}),
    isAttachedPalette: true,
  };

  socket.add(paletteRoot);
}
