// Frame-exact renderer for the showreel page.
//
//   node render/render.mjs still --times 1.2,3.4 [--solo s02-map] [--outdir out/stills]
//   node render/render.mjs sheet --from 0 --to 15 --count 30 [--columns 6] [--solo id] [--out out/sheet.png]
//   node render/render.mjs video [--from 0] [--to 15] [--subframes 8] [--shutter 0.5] [--scale 1]
//                               [--workers 3] [--format jpeg|png] [--crf 17] [--no-windows 1]
//                               [--audio out/audio.wav] [--out out/showreel.mp4]
//
// Video motion blur: each output frame is the average of `subframes` captures spread across
// `shutter` of the frame interval (0.5 = a film camera's 180° shutter), centred on the frame time.
// Spans listed in SC.post.motionBlurWindows (src/post-config.js) get more samples.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FFMPEG = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
const FPS = 60
// Film length comes from the page (SC.DURATION) once it has loaded; see openPage().
let DURATION = 30

function parseOptions(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index].startsWith('--')) throw new Error(`Unexpected argument ${rest[index]}`)
    options[rest[index].slice(2)] = rest[index + 1]
  }
  return { command, options }
}

// Minimal static server — file:// would block the woff2 font loads.
function startServer() {
  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.json': 'application/json', '.png': 'image/png' }
  const server = createServer(async (request, response) => {
    const path = join(projectRoot, decodeURIComponent(new URL(request.url, 'http://localhost').pathname))
    if (!path.startsWith(projectRoot)) { response.writeHead(403); response.end(); return }
    try {
      const body = await readFile(path.endsWith('/') ? join(path, 'index.html') : path)
      response.writeHead(200, { 'content-type': contentTypes[extname(path)] || 'application/octet-stream' })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  return new Promise((resolveServer) => server.listen(0, '127.0.0.1', () => resolveServer(server)))
}

async function openPage(browser, port, { solo, scale = 1 }) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()) })
  const query = new URLSearchParams({ render: '1', ...(solo ? { solo } : {}) })
  await page.goto(`http://127.0.0.1:${port}/index.html?${query}`)
  await page.evaluate(() => window.__scReady)
  if (pageErrors.length) throw new Error(`Page errors:\n${pageErrors.join('\n')}`)
  DURATION = await page.evaluate(() => SC.DURATION)
  const cdp = await context.newCDPSession(page)
  // PNG for stills/sheets; video defaults to JPEG q95 (half the capture time, and the final
  // encode is 4:2:0 H.264 anyway so the difference is invisible).
  const capture = async (time, label, format = 'png') => {
    await page.evaluate(([seekTime, overlay]) => {
      SC.seek(seekTime)
      let tag = document.getElementById('__timecode')
      if (overlay && !tag) {
        tag = document.createElement('div')
        tag.id = '__timecode'
        tag.style.cssText = 'position:absolute;left:12px;top:10px;z-index:3000;font:600 40px JetBrains Mono,monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 10px;border-radius:6px'
        document.getElementById('frame').appendChild(tag)
      }
      if (tag) tag.textContent = overlay || ''
    }, [time, label])
    const { data } = await cdp.send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 95 } : {}), optimizeForSpeed: true })
    if (pageErrors.length) throw new Error(`Page errors at t=${time}:\n${pageErrors.join('\n')}`)
    return Buffer.from(data, 'base64')
  }
  return { page, capture }
}

function runFfmpeg(args, { input } = {}) {
  const process_ = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] })
  const done = new Promise((resolveRun, rejectRun) => {
    process_.on('close', (code) => (code === 0 ? resolveRun() : rejectRun(new Error(`ffmpeg exited ${code}`))))
  })
  return { stdin: process_.stdin, done }
}

async function writeToPipe(stream, buffer) {
  if (!stream.write(buffer)) await new Promise((resolveDrain) => stream.once('drain', resolveDrain))
}

async function renderStills(browser, port, options) {
  const outDirectory = resolve(options.outdir || join(projectRoot, 'out/stills'))
  await mkdir(outDirectory, { recursive: true })
  const { capture } = await openPage(browser, port, { solo: options.solo, scale: Number(options.scale || 1) })
  const times = options.times.split(',').map(Number)
  for (const time of times) {
    const file = join(outDirectory, `${options.solo ? options.solo + '_' : ''}t${time.toFixed(3)}.png`)
    await writeFile(file, await capture(time))
    console.log(file)
  }
}

async function renderSheet(browser, port, options) {
  const from = Number(options.from ?? 0)
  const count = Number(options.count ?? 24)
  const columns = Number(options.columns ?? 6)
  const rows = Math.ceil(count / columns)
  const out = resolve(options.out || join(projectRoot, 'out/sheet.png'))
  await mkdir(dirname(out), { recursive: true })
  const { capture } = await openPage(browser, port, { solo: options.solo, scale: 0.5 })
  const to = Number(options.to ?? DURATION)
  const ffmpeg = runFfmpeg(['-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf', `scale=480:270,tile=${columns}x${rows}:padding=6:color=0x222222`, '-frames:v', '1', out], { input: true })
  for (let index = 0; index < count; index++) {
    const time = count === 1 ? from : from + ((to - from) * index) / (count - 1)
    const clamped = Math.min(time, DURATION - 1 / FPS)
    await writeToPipe(ffmpeg.stdin, await capture(clamped, `${clamped.toFixed(2)}s`))
  }
  ffmpeg.stdin.end()
  await ffmpeg.done
  console.log(out)
}

// Splits [firstFrame, lastFrame) into segments that share one sub-frame count: the default
// everywhere, more inside the page's SC.post.motionBlurWindows (fast moves strobe into visible
// copies at low sample counts). Long segments are cut into ~equal pieces so workers stay busy.
function planSegments(firstFrame, lastFrame, defaultSubframes, windows, pieceWork) {
  const subframesFor = (frame) => windows.reduce((count, window) =>
    frame / FPS >= window.from && frame / FPS < window.to ? Math.max(count, window.subframes) : count, defaultSubframes)
  const runs = []
  for (let frame = firstFrame; frame < lastFrame; frame++) {
    const subframes = subframesFor(frame)
    const last = runs[runs.length - 1]
    if (last && last.subframes === subframes) last.end = frame + 1
    else runs.push({ start: frame, end: frame + 1, subframes })
  }
  return runs.flatMap((run) => {
    const pieces = Math.max(1, Math.round(((run.end - run.start) * run.subframes) / pieceWork))
    const size = Math.ceil((run.end - run.start) / pieces)
    const segments = []
    for (let start = run.start; start < run.end; start += size) segments.push({ start, end: Math.min(run.end, start + size), subframes: run.subframes })
    return segments
  })
}

async function renderVideo(browser, port, options) {
  const from = Number(options.from ?? 0)
  const defaultSubframes = Number(options.subframes ?? 8)
  const shutter = Number(options.shutter ?? 0.5)
  const scale = Number(options.scale ?? 1)
  const workers = Number(options.workers ?? 3)
  const format = options.format || 'jpeg'
  const out = resolve(options.out || join(projectRoot, 'out/showreel.mp4'))
  const scratch = join(dirname(out), `.chunks-${process.pid}`)
  await mkdir(scratch, { recursive: true })

  const startedAt = Date.now()
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, port, { solo: options.solo, scale })))
  const to = Number(options.to ?? DURATION)
  const firstFrame = Math.round(from * FPS)
  const lastFrame = Math.round(to * FPS) // exclusive
  const totalFrames = lastFrame - firstFrame
  const windows = options['no-windows'] ? [] : await pages[0].page.evaluate(() => SC.post.motionBlurWindows || [])
  const plannedWork = (lastFrame - firstFrame) * defaultSubframes
  const segments = planSegments(firstFrame, lastFrame, defaultSubframes, windows, Math.max(240, plannedWork / (workers * 4)))
  const totalCaptures = segments.reduce((sum, segment) => sum + (segment.end - segment.start) * segment.subframes, 0)
  let capturesDone = 0
  let nextSegment = 0

  async function renderSegment(capture, segment, chunkFile) {
    const { subframes } = segment
    const blurFilter = subframes > 1
      ? `format=gbrp,tmix=frames=${subframes},select='eq(mod(n\\,${subframes})\\,${subframes - 1})',setpts=N/(${FPS}*TB)`
      : 'format=gbrp'
    const ffmpeg = runFfmpeg(['-f', 'image2pipe', '-framerate', String(FPS * subframes), '-c:v', format === 'jpeg' ? 'mjpeg' : 'png', '-i', '-',
      '-vf', blurFilter, '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', chunkFile], { input: true })
    for (let frame = segment.start; frame < segment.end; frame++) {
      for (let sample = 0; sample < subframes; sample++) {
        const offset = subframes > 1 ? (sample / (subframes - 1) - 0.5) * shutter : 0
        const time = Math.min(Math.max((frame + offset) / FPS, 0), DURATION - 1e-4)
        await writeToPipe(ffmpeg.stdin, await capture(time, undefined, format))
        capturesDone++
      }
      if (capturesDone % 120 < subframes) {
        const elapsed = (Date.now() - startedAt) / 1000
        process.stdout.write(`\r${capturesDone}/${totalCaptures} captures · ${elapsed.toFixed(0)}s elapsed · ~${((elapsed / capturesDone) * (totalCaptures - capturesDone)).toFixed(0)}s left   `)
      }
    }
    ffmpeg.stdin.end()
    await ffmpeg.done
  }

  const chunkFiles = segments.map((_, index) => join(scratch, `chunk-${String(index).padStart(4, '0')}.mkv`))
  await Promise.all(pages.map(async ({ capture }) => {
    while (nextSegment < segments.length) {
      const index = nextSegment++
      await renderSegment(capture, segments[index], chunkFiles[index])
    }
  }))
  process.stdout.write('\n')

  const listFile = join(scratch, 'list.txt')
  await writeFile(listFile, chunkFiles.map((file) => `file '${file}'`).join('\n'))
  const audioArgs = options.audio && existsSync(options.audio)
    ? ['-ss', String(from), '-t', String(to - from), '-i', resolve(options.audio)]
    : []
  const outputArgs = audioArgs.length ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []
  await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, ...audioArgs, ...outputArgs,
    // Matroska chunks store 1 ms timestamps, so 1/60 s frames drift and a frame at a chunk seam
    // could be dropped when resampling to 60 fps. Re-stamp every frame from its index instead.
    '-vf', `setpts=N/(${FPS}*TB)`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', options.crf || '17', '-preset', options.preset || 'slow',
    '-r', String(FPS), '-movflags', '+faststart', out]).done
  await rm(scratch, { recursive: true, force: true })
  const windowNote = windows.length ? `, ${windows.length} high-sample windows` : ''
  console.log(`${out} (${totalFrames} frames, ${totalCaptures} captures${windowNote}, ${segments.length} segments in ${((Date.now() - startedAt) / 1000).toFixed(0)}s)`)
}

const { command, options } = parseOptions(process.argv.slice(2))
const server = await startServer()
// SwiftShader gives headless Chromium a software WebGL2 implementation for the three.js world.
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const port = server.address().port
  if (command === 'still') await renderStills(browser, port, options)
  else if (command === 'sheet') await renderSheet(browser, port, options)
  else if (command === 'video') await renderVideo(browser, port, options)
  else throw new Error(`Unknown command "${command}" — use still | sheet | video`)
} finally {
  await browser.close()
  server.close()
}
