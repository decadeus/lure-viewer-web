import React from "react";

export function ElementPopup({
  selectedPart,
  bavetteType,
  currentDimensionsCm,
  CM_PER_INCH,
  inchToCm,
  attachOffset,
  setAttachOffset,
  bavetteOffset,
  setBavetteOffset,
  attachRotation,
  setAttachRotation,
  bavetteRotation,
  setBavetteRotation,
  onClose,
}) {
  if (
    !(
      selectedPart === "bavette" ||
      selectedPart === "attach" ||
      selectedPart === "palettes" ||
      selectedPart === "hooks"
    )
  ) {
    return null;
  }

  const worldPerCm = currentDimensionsCm?.worldPerCm || 1;

  const getOffsetValueInch = (axis) => {
    const off =
      selectedPart === "attach"
        ? attachOffset?.[axis] || 0
        : bavetteOffset?.[axis] || 0;
    if (!currentDimensionsCm?.worldPerCm) return off;
    return (off / worldPerCm / CM_PER_INCH).toFixed(2);
  };

  const updateOffsetFromInch = (axis, inches) => {
    const cm = inchToCm(Number(inches));
    const world = cm * worldPerCm;
    if (selectedPart === "attach") {
      setAttachOffset((prev) => ({
        ...(prev || {}),
        [axis]: world,
      }));
    } else {
      setBavetteOffset((prev) => ({
        ...prev,
        [axis]: world,
      }));
    }
  };

  const getRotationValue = (axis) =>
    selectedPart === "attach"
      ? attachRotation?.[axis] ?? 0
      : bavetteRotation?.[axis] ?? 0;

  const updateRotation = (axis, rawValue) => {
    const raw = Number(rawValue);
    const deg = ((raw % 360) + 360) % 360;
    if (selectedPart === "attach") {
      setAttachRotation((prev) => ({
        ...(prev || {}),
        [axis]: deg,
      }));
    } else {
      setBavetteRotation((prev) => ({
        ...prev,
        [axis]: deg,
      }));
    }
  };

  return (
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
          onClick={onClose}
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
          value={getOffsetValueInch("x")}
          step={0.1}
          onChange={(e) => updateOffsetFromInch("x", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ marginRight: 4 }}>Y (in)</span>
        <input
          type="number"
          value={getOffsetValueInch("y")}
          step={0.1}
          onChange={(e) => updateOffsetFromInch("y", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ marginRight: 4 }}>Z (in)</span>
        <input
          type="number"
          value={getOffsetValueInch("z")}
          step={0.1}
          onChange={(e) => updateOffsetFromInch("z", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
      <div style={{ fontWeight: 600, margin: "6px 0 2px" }}>Rotation:</div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ marginRight: 4 }}>X (°)</span>
        <input
          type="number"
          value={getRotationValue("x")}
          step={1}
          onChange={(e) => updateRotation("x", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ marginRight: 4 }}>Y (°)</span>
        <input
          type="number"
          value={getRotationValue("y")}
          step={1}
          onChange={(e) => updateRotation("y", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
      <div>
        <span style={{ marginRight: 4 }}>Z (°)</span>
        <input
          type="number"
          value={getRotationValue("z")}
          step={1}
          onChange={(e) => updateRotation("z", e.target.value)}
          style={{ width: "60%", fontSize: 11 }}
        />
      </div>
    </div>
  );
}


