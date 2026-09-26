// Placeholder smoke test — replaced by the look-dev build.
SC.onInit((stage) => {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  canvas.style.cssText = 'position:absolute;inset:0;z-index:0'
  stage.prepend(canvas)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0B0A10')
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 100)
  camera.position.set(0, 0, 6)
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())
  scene.add(cube)
  SC.afterRender((t) => { cube.rotation.set(t, t * 0.7, 0); renderer.render(scene, camera) })
})
