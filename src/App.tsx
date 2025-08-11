"use client"

import { useEffect, useRef } from "react"

type Burst = {
  x: number
  y: number
  hue: number
  life: number
  maxLife: number
  maxRadius: number
}

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const asciiCanvasRef = useRef<HTMLCanvasElement>(null)

  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext>()
  const analyserRef = useRef<AnalyserNode>()
  const dataArrayRef = useRef<Uint8Array>()
  const streamRef = useRef<MediaStream>()

  // ASCII characters from darkest to lightest
  const asciiChars = " .:-=+*#%@"

  // Ball properties
  const ballRef = useRef({
    x: 0,
    y: 0,
    baseRadius: 100,
    currentRadius: 100,
    targetRadius: 100,
    hue: 200,
    targetHue: 200,
    particles: [] as Array<{
      x: number
      y: number
      vx: number
      vy: number
      life: number
      maxLife: number
      size: number
    }>,
  })

  // Color bursts and wave helpers
  const burstsRef = useRef<Burst[]>([])
  const lastTimeRef = useRef<number>(performance.now() / 1000)
  const prevVolumeRef = useRef(0)
  const smoothVolumeRef = useRef(0)
  const beatCooldownRef = useRef(0)

  const addParticles = (intensity: number, canvas: HTMLCanvasElement) => {
    const ball = ballRef.current
    const particleCount = Math.floor(intensity * 6)

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 4
      ball.particles.push({
        x: ball.x + Math.cos(angle) * ball.currentRadius,
        y: ball.y + Math.sin(angle) * ball.currentRadius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60,
        size: 2 + Math.random() * 3,
      })
    }

    if (ball.particles.length > 250) {
      ball.particles.splice(0, ball.particles.length - 250)
    }
  }

  const spawnBursts = (
    count: number,
    w: number,
    h: number,
    baseHue: number
  ) => {
    const cx = w / 2
    const cy = h / 2
    const minR = Math.min(w, h) * 0.15
    const maxR = Math.min(w, h) * 0.45

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2
      const dist = minR + Math.random() * (maxR - minR)
      const x = cx + Math.cos(ang) * dist
      const y = cy + Math.sin(ang) * dist

      burstsRef.current.push({
        x,
        y,
        hue: (baseHue + Math.random() * 120 - 60 + i * 15) % 360,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
        maxRadius: Math.hypot(w, h) * (0.25 + Math.random() * 0.3),
      })
    }
    // Keep memory in check
    if (burstsRef.current.length > 40) {
      burstsRef.current.splice(0, burstsRef.current.length - 40)
    }
  }

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

  const drawBursts = (
    ctx: CanvasRenderingContext2D,
    dt: number,
    baseHue: number
  ) => {
    ctx.save()
    ctx.globalCompositeOperation = "lighter"

    for (let i = burstsRef.current.length - 1; i >= 0; i--) {
      const b = burstsRef.current[i]
      b.life += dt
      const p = Math.min(1, b.life / b.maxLife)
      const r = easeOutCubic(p) * b.maxRadius

      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
      const h0 = (b.hue + baseHue * 0.05) % 360
      g.addColorStop(0.0, `hsla(${h0}, 100%, 92%, ${0.95 * (1 - p / 2)})`)
      g.addColorStop(0.25, `hsla(${h0 + 20}, 100%, 70%, ${0.7 * (1 - p)})`)
      g.addColorStop(0.6, `hsla(${h0 + 60}, 100%, 55%, ${0.28 * (1 - p)})`)
      g.addColorStop(1.0, `hsla(${h0 + 90}, 100%, 50%, 0)`)

      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.fill()

      if (p >= 1) {
        burstsRef.current.splice(i, 1)
      }
    }

    ctx.restore()
  }

  const drawColorWaves = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    baseHue: number,
    volume: number
  ) => {
    ctx.save()
    ctx.globalCompositeOperation = "lighter"

    const cx = w / 2
    const cy = h / 2
    const diag = Math.hypot(w, h)

    // Radial ring pulses (expanding circles)
    const ringCount = 5 + Math.floor(volume * 5)
    const ringSpeed = 0.25 + volume * 1.4
    const lw = 6 + volume * 26
    for (let i = 0; i < ringCount; i++) {
      const progress = (t * ringSpeed + i / ringCount) % 1
      const r = 40 + progress * (diag * 0.55)
      const alpha = 0.05 + volume * 0.18
      const hue = (baseHue + i * 24) % 360

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, ${60 + progress * 25}%, ${alpha})`
      ctx.lineWidth = lw
      ctx.stroke()
    }

    // Horizontal aurora waves
    const waveCount = 6
    const baseAmp = 40 + volume * 180
    const freq = 0.012 + volume * 0.02
    const speed = 2 + volume * 6
    for (let j = 0; j < waveCount; j++) {
      const phase = j * 0.9
      const hue = (baseHue + 20 * j + t * 15) % 360
      const yBase = (h * (j + 1)) / (waveCount + 1)
      const lw2 = 3 + volume * 12

      ctx.beginPath()
      for (let x = -40; x <= w + 40; x += 14) {
        const y =
          yBase +
          Math.sin(x * freq + t * speed + phase) * (baseAmp * (0.6 + j / 7))
        if (x === -40) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.15 + volume * 0.25})`
      ctx.lineWidth = lw2
      ctx.stroke()
    }

    // Vertical waves (fewer, thicker)
    const vCount = 3
    const baseAmpV = 30 + volume * 160
    const freqV = 0.013 + volume * 0.018
    for (let j = 0; j < vCount; j++) {
      const phase = j * 1.1
      const hue = (baseHue + 70 * j - t * 12) % 360
      const xBase = (w * (j + 1)) / (vCount + 1)
      const lw3 = 4 + volume * 14

      ctx.beginPath()
      for (let y = -40; y <= h + 40; y += 14) {
        const x =
          xBase +
          Math.sin(y * freqV + t * (speed * 0.85) + phase) *
            (baseAmpV * (0.65 + j / 6))
        if (y === -40) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.14 + volume * 0.24})`
      ctx.lineWidth = lw3
      ctx.stroke()
    }

    ctx.restore()
  }

  // Convert the render canvas to colored ASCII with audio-driven pop
  const convertToAscii = () => {
    const canvas = canvasRef.current
    const asciiCanvas = asciiCanvasRef.current
    if (!canvas || !asciiCanvas) return

    const srcCtx = canvas.getContext("2d")
    const dstCtx = asciiCanvas.getContext("2d")
    if (!srcCtx || !dstCtx) return

    if (canvas.width <= 0 || canvas.height <= 0) return

    // Tweak for quality/perf. Smaller = more detail but heavier.
    const charWidth = 5
    const charHeight = 10
    const cols = Math.floor(canvas.width / charWidth)
    const rows = Math.floor(canvas.height / charHeight)
    if (cols <= 0 || rows <= 0) return

    let imageData: ImageData
    try {
      imageData = srcCtx.getImageData(0, 0, canvas.width, canvas.height)
    } catch (error) {
      console.warn("Failed to get image data:", error)
      return
    }

    const pixels = imageData.data

    // Prepare ASCII canvas
    dstCtx.clearRect(0, 0, asciiCanvas.width, asciiCanvas.height)
    dstCtx.fillStyle = "black"
    dstCtx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height)

    // Font setup
    const fontSize = Math.max(7, Math.floor(charHeight * 0.95))
    dstCtx.font = `900 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
    dstCtx.textBaseline = "middle"
    dstCtx.textAlign = "center"
    dstCtx.imageSmoothingEnabled = false

    const volume = smoothVolumeRef.current

    // Draw per cell
    for (let y = 0; y < rows; y++) {
      const drawY = y * charHeight + charHeight / 2
      for (let x = 0; x < cols; x++) {
        const px = Math.floor(x * charWidth + charWidth / 2)
        const py = Math.floor(y * charHeight + charHeight / 2)
        if (px >= canvas.width || py >= canvas.height) continue

        const idx = (py * canvas.width + px) * 4
        const r = pixels[idx] || 0
        const g = pixels[idx + 1] || 0
        const b = pixels[idx + 2] || 0

        // Perceived brightness → ASCII char
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
        const bn = brightness / 255
        const charIndex = Math.floor(bn * (asciiChars.length - 1))
        const ch = asciiChars[charIndex]
        if (ch === " ") continue

        // Audio-reactive pop:
        // - Boost saturation by pulling channels toward the max
        // - Boost brightness multiplicatively
        const maxC = Math.max(r, g, b)
        const satBoost = 0.25 + volume * 0.75
        const brightBoost = 0.7 + volume * 1.6

        let rr = r + (maxC - r) * satBoost
        let gg = g + (maxC - g) * satBoost
        let bb = b + (maxC - b) * satBoost

        rr = Math.min(255, rr * brightBoost)
        gg = Math.min(255, gg * brightBoost)
        bb = Math.min(255, bb * brightBoost)

        dstCtx.fillStyle = `rgb(${rr | 0}, ${gg | 0}, ${bb | 0})`
        const drawX = x * charWidth + charWidth / 2
        dstCtx.fillText(ch, drawX, drawY)
      }
    }
  }

  const animate = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const now = performance.now() / 1000
    const dt = Math.min(0.05, now - lastTimeRef.current)
    lastTimeRef.current = now

    const w = canvas.width
    const h = canvas.height
    if (w <= 0 || h <= 0) {
      animationRef.current = requestAnimationFrame(animate)
      return
    }

    const ball = ballRef.current

    // Analyze audio
    let volume = 0
    let dominantFreq = 0

    if (analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)

      const arr = dataArrayRef.current
      let sum = 0
      let maxAmp = 0
      let maxIdx = 0
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i]
        sum += v
        if (v > maxAmp) {
          maxAmp = v
          maxIdx = i
        }
      }
      volume = (sum / arr.length) / 255
      volume = Math.min(1, volume * 3) // global boost
      dominantFreq = maxIdx / arr.length
    } else {
      // No mic: gentle LFO fallback
      const t = now
      volume = 0.2 + (Math.sin(t * 1.5) * 0.5 + 0.5) * 0.2
      dominantFreq = (Math.sin(now * 0.3) * 0.5 + 0.5) * 0.8
    }

    // Smooth volume for stable visuals
    smoothVolumeRef.current += (volume - smoothVolumeRef.current) * 0.2

    // Beat-ish detection for bursts
    beatCooldownRef.current = Math.max(0, beatCooldownRef.current - dt)
    const prevV = prevVolumeRef.current
    const vNow = smoothVolumeRef.current
    const rising = vNow - prevV
    if (
      vNow > 0.35 &&
      rising > 0.08 &&
      beatCooldownRef.current <= 0
    ) {
      const burstCount = 2 + Math.floor(vNow * 5)
      spawnBursts(burstCount, w, h, ball.hue)
      beatCooldownRef.current = 0.12 // cooldown seconds
    }
    prevVolumeRef.current = vNow

    // Ball dynamics
    ball.targetRadius = ball.baseRadius + vNow * 140
    ball.targetHue = (dominantFreq * 360) % 360

    ball.currentRadius += (ball.targetRadius - ball.currentRadius) * 0.1
    ball.hue += (ball.targetHue - ball.hue) * 0.1

    ball.x = w / 2
    ball.y = h / 2

    // Motion trail fade (less fade at high volume → brighter persistence)
    const fade = 0.55 - vNow * 0.35 // 0.55→0.2
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.18, fade)})`
    ctx.fillRect(0, 0, w, h)

    // Waves that flood the screen with color
    drawColorWaves(ctx, w, h, now, ball.hue, vNow)

    // Draw the audio-reactive ball (vivid gradient)
    const g = ctx.createRadialGradient(
      ball.x,
      ball.y,
      0,
      ball.x,
      ball.y,
      ball.currentRadius
    )
    g.addColorStop(0, `hsla(${ball.hue}, 100%, 90%, 1)`)
    g.addColorStop(0.5, `hsla(${ball.hue}, 95%, 62%, 0.95)`)
    g.addColorStop(1, `hsla(${ball.hue}, 90%, 35%, 0.2)`)
    ctx.save()
    ctx.shadowColor = `hsla(${ball.hue}, 100%, 75%, ${0.5 + vNow * 0.4})`
    ctx.shadowBlur = 30 + vNow * 40
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.currentRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Inner core pop
    const core = ctx.createRadialGradient(
      ball.x,
      ball.y,
      0,
      ball.x,
      ball.y,
      ball.currentRadius * 0.33
    )
    core.addColorStop(0, `hsla(${ball.hue}, 100%, 96%, 1)`)
    core.addColorStop(1, `hsla(${ball.hue}, 100%, 80%, 0.35)`)
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(
      ball.x,
      ball.y,
      ball.currentRadius * (0.28 + vNow * 0.07),
      0,
      Math.PI * 2
    )
    ctx.fill()

    // Particles
    if (vNow > 0.04) addParticles(vNow, canvas)
    ball.particles.forEach((p, i) => {
      p.x += p.vx
      p.y += p.vy
      p.life--
      const a = p.life / p.maxLife
      ctx.fillStyle = `hsla(${ball.hue}, 98%, 85%, ${a})`
      ctx.shadowColor = `hsla(${ball.hue}, 100%, 80%, ${a})`
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
      ctx.fill()
      if (p.life <= 0) ball.particles.splice(i, 1)
    })
    ctx.shadowBlur = 0

    // Frequency bars around ball (bright)
    if (analyserRef.current && dataArrayRef.current) {
      const arr = dataArrayRef.current
      const barCount = 32
      const step = Math.floor(arr.length / barCount)
      const angleStep = (Math.PI * 2) / barCount
      ctx.save()
      ctx.globalCompositeOperation = "lighter"
      for (let i = 0; i < barCount; i++) {
        const angle = i * angleStep
        const amp = Math.min(1, (arr[i * step] / 255) * 3)
        const len = amp * 70 * (0.8 + vNow * 0.5)
        const sx =
          ball.x + Math.cos(angle) * (ball.currentRadius + 12)
        const sy =
          ball.y + Math.sin(angle) * (ball.currentRadius + 12)
        const ex =
          ball.x +
          Math.cos(angle) * (ball.currentRadius + 12 + len)
        const ey =
          ball.y +
          Math.sin(angle) * (ball.currentRadius + 12 + len)

        ctx.strokeStyle = `hsla(${ball.hue + i * 3}, 100%, ${
          55 + amp * 35
        }%, ${0.3 + amp * 0.6})`
        ctx.lineWidth = 3 + amp * 3
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Color bursts (on beats)
    drawBursts(ctx, dt, ball.hue)

    // Convert to colored ASCII overlay
    convertToAscii()

    animationRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const asciiCanvas = asciiCanvasRef.current
    if (!canvas || !asciiCanvas) return

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w
      canvas.height = h
      asciiCanvas.width = w
      asciiCanvas.height = h
    }

    resize()
    window.addEventListener("resize", resize)

    const initAudio = async () => {
      try {
        const constraints = {
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 1,
            volume: 1.0,
          },
        } as MediaStreamConstraints

        const stream = await navigator.mediaDevices.getUserMedia(
          constraints
        )
        streamRef.current = stream

        const AudioCtx =
          window.AudioContext ||
          // @ts-ignore
          window.webkitAudioContext
        const audioContext = new AudioCtx({
          sampleRate: 48000,
        })

        const analyser = audioContext.createAnalyser()
        const source = audioContext.createMediaStreamSource(stream)

        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.5

        const gainNode = audioContext.createGain()
        gainNode.gain.value = 3.0 // global boost
        source.connect(gainNode)
        gainNode.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

        console.log("Audio initialized with high sensitivity")
      } catch (err) {
        console.error("Error accessing microphone:", err)
      }
    }

    initAudio()

    setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate)
    }, 80)

    return () => {
      window.removeEventListener("resize", resize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 bg-black">
      {/* Hidden render canvas (source for ASCII sampling) */}
      <canvas ref={canvasRef} className="w-full h-full opacity-0" />

      {/* Colored ASCII overlay canvas */}
      <canvas
        ref={asciiCanvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
