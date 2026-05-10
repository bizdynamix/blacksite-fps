export function initPostProcessing(renderer, scene, camera) {
  // Placeholder for a future EffectComposer pipeline.
  return {
    render: () => renderer.render(scene, camera)
  };
}
