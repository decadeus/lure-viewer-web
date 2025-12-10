import * as THREE from "three";

/**
 * Attache dynamiquement un triple (N_Triple_Asset.glb) au leurre Lurepret.
 *
 * Hypothèses côté GLTF :
 * - Fichier : public/Triple/N_Triple_Asset.glb
 * - On a 4 ensembles de triples alignés dans la scène (#1, #2, #4, #6).
 * - Pour chaque taille, il existe un Empty d'attache dédié :
 *   Trple_Attach_1 / 2 / 4 / 6 (ou variantes proches).
 * - Les crochets sont des meshes dont le nom commence par "Torus" ou "Triple".
 *
 * Cette fonction :
 * - clone toute la scène des triples,
 * - choisit l'Empty correspondant à la taille,
 * - garde visibles UNIQUEMENT les 3 meshes (2 Torus + 1 Triple) les plus proches
 *   de cet Empty,
 * - recentre le groupe sur cet Empty,
 * - et l'accroche sur le socket demandé du leurre (par défaut "Attach_Down_add").
 */
export function attachTripleToLure({
  scene,
  tripleGltf,
  tripleSize,
  socketName = "Attach_Down_add",
  lureScale = 1,
}) {
  if (!scene || !tripleGltf?.scene) return;

  const socket = scene.getObjectByName(socketName);
  if (!socket) return;

  // Supprimer tout ancien Triple déjà attaché
  socket.children
    .slice()
    .forEach((child) => {
      if (child.userData?.isAttachedTriple) {
        socket.remove(child);
      }
    });

  const tripleRoot = tripleGltf.scene.clone(true);

  // Compenser la taille globale du leurre :
  // si le leurre est agrandi (L / XL), on réduit
  // le triple pour qu'il garde une taille monde constante.
  const scaleFactor =
    Number.isFinite(lureScale) && lureScale > 0 ? lureScale : 1;
  if (scaleFactor !== 1) {
    tripleRoot.scale.multiplyScalar(1 / scaleFactor);
  }

  const variantKeys = ["Triple_#1", "Triple_#2", "Triple_#4", "Triple_#6"];
  const defaultVariantKey = "Triple_#4";
  const selectedKey = variantKeys.includes(tripleSize)
    ? tripleSize
    : defaultVariantKey;

  // 1) Trouver l'Empty d'attache correspondant à la taille choisie
  const attachNameBySize = {
    "Triple_#1": [
      "Trple_Attach_1",
      "Triple_Attach_1",
      "TripleAttach_1",
      "Trple_Attach",
      "Triple_Attach",
    ],
    "Triple_#2": [
      "Trple_Attach_2",
      "Triple_Attach_2",
      "TripleAttach_2",
    ],
    "Triple_#4": [
      "Trple_Attach4",
      "Triple_Attach4",
      "TripleAttach_4",
    ],
    "Triple_#6": [
      "Trple_Attach6",
      "Triple_Attach6",
      "TripleAttach_6",
    ],
  };

  const wantedNames = attachNameBySize[selectedKey] || [];
  let attachMarker = null;
  tripleRoot.traverse((child) => {
    if (!child.name || attachMarker) return;
    if (wantedNames.includes(child.name)) {
      attachMarker = child;
    }
  });

  if (attachMarker) {
    // 2) Calculer la position monde de l'Empty d'attache
    tripleRoot.updateWorldMatrix(true, true);
    attachMarker.updateWorldMatrix(true, true);
    const refWorldPos = new THREE.Vector3();
    attachMarker.getWorldPosition(refWorldPos);

    // 3) Lister tous les meshes "Torus*" / "Triple*" et calculer leur distance
    const hookCandidates = [];
    tripleRoot.traverse((child) => {
      if (!child.isMesh) return;
      const name = child.name || "";
      const isHookMesh =
        name.startsWith("Torus") || name.startsWith("Triple");
      if (!isHookMesh) {
        return;
      }
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      const dist = worldPos.distanceTo(refWorldPos);
      hookCandidates.push({ mesh: child, dist });
    });

    // 4) Garder visibles uniquement les 3 meshes les plus proches
    hookCandidates.sort((a, b) => a.dist - b.dist);
    const keepCount = Math.min(3, hookCandidates.length);
    hookCandidates.forEach((entry, index) => {
      entry.mesh.visible = index < keepCount;
    });

    // 5) Recentrer toute la scène sur l'Empty d'attache (origine locale)
    attachMarker.updateWorldMatrix(false, false);
    const attachPosLocal = attachMarker.position.clone();
    tripleRoot.position.sub(attachPosLocal);
  }

  // Cloner aussi les matériaux pour éviter les effets de bord entre instances
  tripleRoot.traverse((child) => {
    if (child.isMesh && child.material) {
      // Certains matériaux peuvent être partagés entre les instances ; on clone
      // systématiquement pour éviter les modifications croisées.
      child.material = child.material.clone();
    }
  });

  tripleRoot.userData = {
    ...(tripleRoot.userData || {}),
    isAttachedTriple: true,
  };

  socket.add(tripleRoot);
}
