// Temporary smoke test for the engine and renderer; replaced by the storyboard scenes.
SC.scene({
  id: 'engine-test',
  start: 0,
  end: 15,
  build(root, api) {
    const logo = api.createLogo(root, { height: 120 })
    Object.assign(logo.root.style, { position: 'absolute', left: '262px', top: '480px' })
    return { logo }
  },
  render(t, state, api) {
    state.logo.letters.forEach((letter, index) => {
      const start = api.stagger(index, state.logo.letters.length, { start: 0.2, each: 0.05 })
      const y = api.tween(t, start, start + 0.8, 20, 0, 'snappy')
      api.setStyle(letter.path, { transform: `translateY(${y}px) scaleY(${1 + (index === 5 ? 0.4 * Math.sin(t * 3) : 0)})`, opacity: api.progress(t, start, start + 0.2) })
    })
  },
})
