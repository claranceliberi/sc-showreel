// Scene modules, loaded in this order by index.html after three.js is available as window.THREE.
// world3d.js is not a scene: it owns the renderer, studio, lights, materials, shared props and the
// single continuous camera, and draws the 3D frame after every scene has updated (SC.afterRender).
window.SC_SCENE_FILES = [
  'world3d.js',
  's1-name.js',
  's2-far-home.js',
  's3-data.js',
  's4-money.js',
  's5-mark.js',
]
