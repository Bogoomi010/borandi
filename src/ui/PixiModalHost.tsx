import { useSyncExternalStore } from "react";
import { getReactOverlays, subscribeReactOverlays, type ReactOverlay } from "./reactOverlayBridge";
import { PixiPauseModal } from "./PixiPauseModal";
import {
  PixiAboutModal,
  PixiBalanceGateModal,
  PixiCollectionModal,
  PixiConfirmModal,
  PixiHelpModal,
  PixiLoadModal,
  PixiManualProofModal,
  PixiNewRunModal,
  PixiOptionsModal,
  PixiRelicChoiceModal,
  PixiResultModal,
  PixiSaveModal,
  PixiSelectorModal,
  PixiSimulationModal,
  PixiUpgradeModal,
} from "./PixiSimpleModals";

function renderOverlay(overlay: ReactOverlay) {
  if (overlay.kind === "pause") return <PixiPauseModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "options") return <PixiOptionsModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "newRun") return <PixiNewRunModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "selector") return <PixiSelectorModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "relicChoice") return <PixiRelicChoiceModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "save") return <PixiSaveModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "load") return <PixiLoadModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "upgrade") return <PixiUpgradeModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "help") return <PixiHelpModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "about") return <PixiAboutModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "confirm") return <PixiConfirmModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "simulation") return <PixiSimulationModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "balanceGate") return <PixiBalanceGateModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "manualProof") return <PixiManualProofModal key={overlay.id} overlay={overlay} />;
  if (overlay.kind === "result") return <PixiResultModal key={overlay.id} overlay={overlay} />;
  return <PixiCollectionModal key={overlay.id} overlay={overlay} />;
}

export function PixiModalHost() {
  const overlays = useSyncExternalStore(subscribeReactOverlays, getReactOverlays, getReactOverlays);

  return (
    <div id="modal-root">
      {overlays.map((overlay) => renderOverlay(overlay))}
    </div>
  );
}
