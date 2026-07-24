// Same export the ziyue repo's IntroScreen imports, so that component can be
// used unmodified. Here "assets ready" means the room's LoadingManager is
// done; main.js calls markAssetsReady() from manager.onLoad.

let resolveReady: () => void;

const ready = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

export function preloadResumeProjectImages(): Promise<void> {
  return ready;
}

export function markAssetsReady(): void {
  resolveReady();
}
