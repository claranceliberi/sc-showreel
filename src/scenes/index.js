// Scene modules, loaded in this order by index.html. Each scene file calls SC.scene({...});
// shared-map.js defines the map/route/odometer formulas that s02 and s03 must share exactly.
window.SC_SCENE_FILES = [
  'shared-map.js',
  's01-stretch.js',
  's02-far.js',
  's03-snap.js',
  's04-in-country.js',
  's05-spec-stack.js',
  's06-lockup.js',
]
