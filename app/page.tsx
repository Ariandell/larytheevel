"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";

type MonitorId = "left" | "center" | "right";
type IntroPhase = "camera" | "blackout" | "larry" | "died" | "respawn" | "lamp" | "office";
type CornerId = "tl" | "tr" | "br" | "bl";
type SideId = "top" | "right" | "bottom" | "left";
type Point = { x: number; y: number };
type MonitorConfig = {
  corners: Record<CornerId, Point>;
  curveTop: number;
  curveRight: number;
  curveBottom: number;
  curveLeft: number;
  contentScale: number;
  screenAlpha: number;
};
type ScreenConfigs = Record<MonitorId, MonitorConfig>;
type GenerationState = "idle" | "working" | "ready" | "error";
type ArchiveItem = {
  id: number;
  name: string;
  style: string;
  source: string;
  tone: number;
  credit?: string;
  sourceUrl?: string;
  reportedBy?: string;
  threat?: string;
  lastSeen?: string;
  fileExtension?: string;
};

const personalArchiveDatabase = "evil-larry-personal-archive";
const personalArchiveStore = "generations";
const deathSceneDuration = 5600;

const monitorIds: MonitorId[] = ["left", "center", "right"];
const cornerIds: CornerId[] = ["tl", "tr", "br", "bl"];
const introTiming = {
  battery: 1000,
  powerOff: 2400,
  larry: 3000,
  died: 6707,
  respawn: 6707 + deathSceneDuration,
};

// Final monitor geometry captured from the approved on-page calibration.
const screens: ScreenConfigs = {
  left: {
    corners: {
      tl: { x: 19.1, y: 55.5481 },
      tr: { x: 30.2127, y: 54.5856 },
      br: { x: 30.5529, y: 69.8428 },
      bl: { x: 19.4515, y: 72.9929 },
    },
    curveTop: 4.4291,
    curveRight: 3.291,
    curveBottom: 3.0562,
    curveLeft: 4.0683,
    contentScale: 1,
    screenAlpha: .24,
  },
  center: {
    corners: {
      tl: { x: 43.9971, y: 47.0803 },
      tr: { x: 55.926, y: 47.0803 },
      br: { x: 56.1098, y: 64.0839 },
      bl: { x: 44.1196, y: 64.5196 },
    },
    curveTop: 4.3827,
    curveRight: 4.0113,
    curveBottom: 4.1056,
    curveLeft: 4.783,
    contentScale: 1,
    screenAlpha: .24,
  },
  right: {
    corners: {
      tl: { x: 69.9034, y: 54.7356 },
      tr: { x: 81.1402, y: 55.5981 },
      br: { x: 80.6211, y: 72.684 },
      bl: { x: 69.4407, y: 69.7928 },
    },
    curveTop: 5.0662,
    curveRight: 3.3539,
    curveBottom: 4.3504,
    curveLeft: 2.4571,
    contentScale: 1,
    screenAlpha: .24,
  },
};

const monitorCopy: Record<MonitorId, { code: string; title: string; detail: string }> = {
  left: { code: "GEN-01", title: "SUMMON LARRY", detail: "One of one hundred Larry identities is waiting for you." },
  center: { code: "CAM-06", title: "LIVE SURVEILLANCE", detail: "Central corridor feed. Motion status: unknown." },
  right: { code: "ARC-09", title: "THE ARCHIVES", detail: "Recovered footage, classified memes and sightings." },
};

const desktopApps = [
  { id: "x", glyph: "X", label: "X / TWITTER", detail: "PUBLIC TRANSMISSION CHANNEL // LINK AWAITING CONFIGURATION" },
  { id: "telegram", glyph: "TG", label: "TELEGRAM", detail: "LARRY COMMUNITY UPLINK // LINK AWAITING CONFIGURATION" },
  { id: "contract", glyph: "0X", label: "CONTRACT", detail: "TOKEN ADDRESS // NOT YET ASSIGNED" },
  { id: "lore", glyph: "?", label: "LARRY.DAT", detail: "CLASSIFIED ORIGIN FILE // 9 RECORDS RECOVERED" },
  { id: "terminal", glyph: ">_", label: "TERMINAL", detail: "ROOT ACCESS DENIED // LARRY IS WATCHING" },
];

const memeNames = [
  "THE STARE THAT OWES RENT", "BATTERY EATER", "WIFI INSPECTOR", "CEILING DEMON", "UNPAID VET BILL",
  "THE 3AM SUPERVISOR", "MOM SAID NO CATNIP", "DO NOT MAKE EYE CONTACT", "MICROWAVE WITNESS", "FRIDGE RAID BOSS",
  "SILLY BUT ARMED", "THE LAST KIBBLE", "ORIENTATION FAILED", "TAX AUDITOR", "KEYBOARD POSSESSION",
  "NIGHT SHIFT MANAGER", "TREAT NEGOTIATOR", "LITTLE GUY, BIG CRIMES", "FBI MOST WANTED CAT", "THE BLINKLESS ONE",
  "DOORWAY JUMPSCARE", "MOUSE UNION BUSTER", "CABLE CHEWER", "NO THOUGHTS, JUST LARRY", "CATNIP KINGPIN",
  "THE LOOMING", "VACUUM SURVIVOR", "FEED ME OR ELSE", "SCREEN WATCHER", "FINAL BOSS: LARRY",
];

const memeReports = ["THE GROUP CHAT", "A POTATO CAMERA", "AN UNRELIABLE WITNESS", "THE NEIGHBOR'S RING CAM", "THE KITCHEN FRIDGE", "A SHAKY HAND" ];
const memeThreats = ["MILDLY CONCERNING", "SNACK-MOTIVATED", "TOO SILLY TO TRUST", "DO NOT PET", "PROBABLY HUNGRY", "POSSIBLY OMNISCIENT"];
const memeLocations = ["YOUR PERIPHERAL VISION", "BEHIND THE CURTAIN", "THE KITCHEN AT 3:00 AM", "UNDER THE DESK", "ON THE WIFI", "IN THE WALLS"];

const initialArchive: ArchiveItem[] = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: 1000 + index,
    name: memeNames[index],
    style: `CASE ${number} // ${memeThreats[index % memeThreats.length]}`,
    source: `/assets/memes/larry-meme-${number}.jpg`,
    tone: 4,
    reportedBy: memeReports[index % memeReports.length],
    threat: memeThreats[index % memeThreats.length],
    lastSeen: memeLocations[index % memeLocations.length],
  };
});

function openPersonalArchive() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(personalArchiveDatabase, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(personalArchiveStore)) {
        request.result.createObjectStore(personalArchiveStore, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadPersonalGenerations() {
  const database = await openPersonalArchive();
  return new Promise<ArchiveItem[]>((resolve, reject) => {
    const transaction = database.transaction(personalArchiveStore, "readonly");
    const request = transaction.objectStore(personalArchiveStore).getAll();
    request.onsuccess = () => resolve((request.result as ArchiveItem[]).sort((a, b) => b.id - a.id));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function savePersonalGeneration(item: ArchiveItem) {
  const database = await openPersonalArchive();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(personalArchiveStore, "readwrite");
    transaction.objectStore(personalArchiveStore).put(item);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function boundsOf(config: MonitorConfig) {
  const points = cornerIds.map((corner) => config.corners[corner]);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, width: right - left, height: bottom - top };
}

function screenRotation(config: MonitorConfig) {
  const { tl, tr } = config.corners;
  return Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180 / Math.PI;
}

function edgeControls(a: Point, b: Point, strength: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / length, y: -dx / length };
  return [
    { x: a.x + dx / 3 + normal.x * strength, y: a.y + dy / 3 + normal.y * strength },
    { x: a.x + dx * 2 / 3 + normal.x * strength, y: a.y + dy * 2 / 3 + normal.y * strength },
  ];
}

function makeMaskPath(config: MonitorConfig) {
  const { tl, tr, br, bl } = config.corners;
  const averageWidth = (distance(tl, tr) + distance(bl, br)) / 2;
  const averageHeight = (distance(tl, bl) + distance(tr, br)) / 2;
  const strengths: Record<SideId, number> = {
    top: averageHeight * config.curveTop / 100,
    right: averageWidth * config.curveRight / 100,
    bottom: averageHeight * config.curveBottom / 100,
    left: averageWidth * config.curveLeft / 100,
  };
  const [top1, top2] = edgeControls(tl, tr, strengths.top);
  const [right1, right2] = edgeControls(tr, br, strengths.right);
  const [bottom1, bottom2] = edgeControls(br, bl, strengths.bottom);
  const [left1, left2] = edgeControls(bl, tl, strengths.left);
  const n = (value: number) => (value / 100).toFixed(5);

  return [
    `M ${n(tl.x)} ${n(tl.y)}`,
    `C ${n(top1.x)} ${n(top1.y)} ${n(top2.x)} ${n(top2.y)} ${n(tr.x)} ${n(tr.y)}`,
    `C ${n(right1.x)} ${n(right1.y)} ${n(right2.x)} ${n(right2.y)} ${n(br.x)} ${n(br.y)}`,
    `C ${n(bottom1.x)} ${n(bottom1.y)} ${n(bottom2.x)} ${n(bottom2.y)} ${n(bl.x)} ${n(bl.y)}`,
    `C ${n(left1.x)} ${n(left1.y)} ${n(left2.x)} ${n(left2.y)} ${n(tl.x)} ${n(tl.y)} Z`,
  ].join(" ");
}

export default function Home() {
  const loopRef = useRef<HTMLVideoElement>(null);
  const batteryAudioRef = useRef<HTMLAudioElement>(null);
  const cameraOffAudioRef = useRef<HTMLAudioElement>(null);
  const larryAudioRef = useRef<HTMLAudioElement>(null);
  const deathAudioRef = useRef<HTMLAudioElement>(null);
  const monitorAudioRef = useRef<HTMLAudioElement>(null);
  const monitorOpenAudioRef = useRef<HTMLAudioElement>(null);
  const officeStartedRef = useRef(false);
  const phaseTimersRef = useRef<number[]>([]);
  const officeAudioDataRef = useRef<ArrayBuffer | null>(null);
  const officeAudioContextRef = useRef<AudioContext | null>(null);
  const officeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const officeAudioGainRef = useRef<GainNode | null>(null);
  const [online, setOnline] = useState(false);
  const [phase, setPhase] = useState<IntroPhase>("camera");
  const [focus, setFocus] = useState<MonitorId | null>(null);
  const [sound, setSound] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [selectedApp, setSelectedApp] = useState(desktopApps[0].id);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [generatedSource, setGeneratedSource] = useState<string | null>(null);
  const [generatedDownloadName, setGeneratedDownloadName] = useState("larry-output.png");
  const [generatedPresetName, setGeneratedPresetName] = useState("UNKNOWN LARRY");
  const [personalGenerationCount, setPersonalGenerationCount] = useState(0);
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>(initialArchive);
  const [selectedArchive, setSelectedArchive] = useState(initialArchive[0].id);

  useEffect(() => {
    const audioRequest = new AbortController();
    loopRef.current?.load();
    const larryPreload = new window.Image();
    larryPreload.src = "/assets/larry-dark-plate-v1.png";
    fetch("/assets/audio/office-ambience-loop.wav", { signal: audioRequest.signal })
      .then((response) => response.arrayBuffer())
      .then((data) => { officeAudioDataRef.current = data; })
      .catch(() => { /* Room ambience can still load after the respawn click. */ });
    return () => {
      audioRequest.abort();
      phaseTimersRef.current.forEach(window.clearTimeout);
      [batteryAudioRef, cameraOffAudioRef, larryAudioRef, deathAudioRef, monitorAudioRef, monitorOpenAudioRef]
        .forEach((ref) => ref.current?.pause());
      try { officeAudioSourceRef.current?.stop(); } catch { /* Already stopped. */ }
      void officeAudioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    void loadPersonalGenerations()
      .then((personalItems) => {
        if (!personalItems.length) return;
        const normalizedItems = personalItems.map((item) => ({ ...item, tone: 4 }));
        const latest = normalizedItems[0];
        setArchiveItems([...normalizedItems, ...initialArchive]);
        setSelectedArchive(latest.id);
        setGeneratedSource(latest.source);
        setGeneratedDownloadName(`${latest.name}.${latest.fileExtension || "png"}`);
        setGeneratedPresetName(latest.style);
        setPersonalGenerationCount(personalItems.length);
      })
      .catch(() => { /* Private browsing may disable persistent browser storage. */ });
  }, []);

  function clearPhaseTimers() {
    phaseTimersRef.current.forEach(window.clearTimeout);
    phaseTimersRef.current = [];
  }

  function playEffect(ref: { current: HTMLAudioElement | null }, volume = .5) {
    if (!sound || !ref.current) return;
    ref.current.currentTime = 0;
    ref.current.volume = volume;
    ref.current.muted = false;
    void ref.current.play().catch(() => { /* Playback has already been user-unlocked. */ });
  }

  function scheduleIntro() {
    clearPhaseTimers();
    officeStartedRef.current = false;
    setOnline(false);
    setFocus(null);
    setPhase("camera");
    phaseTimersRef.current = [
      window.setTimeout(() => playEffect(batteryAudioRef), introTiming.battery),
      window.setTimeout(() => {
        setPhase("blackout");
        playEffect(cameraOffAudioRef);
      }, introTiming.powerOff),
      window.setTimeout(() => {
        setPhase("larry");
        playEffect(larryAudioRef, .3);
      }, introTiming.larry),
      window.setTimeout(() => {
        setPhase("died");
        playEffect(deathAudioRef);
      }, introTiming.died),
      window.setTimeout(() => setPhase("respawn"), introTiming.respawn),
    ];
  }

  async function enableIntroAudio() {
    const unlockAudio = batteryAudioRef.current;
    if (unlockAudio) {
      unlockAudio.volume = 0;
      try {
        await unlockAudio.play();
        unlockAudio.pause();
        unlockAudio.currentTime = 0;
      } catch { /* The next explicit media action may still unlock playback. */ }
    }
    setSound(true);
    setInitialized(true);
    scheduleIntro();
  }

  async function startOfficeAmbience() {
    if (officeAudioSourceRef.current) return;
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    officeAudioContextRef.current = context;
    await context.resume();
    const encodedAudio = officeAudioDataRef.current
      ?? await fetch("/assets/audio/office-ambience-loop.wav").then((response) => response.arrayBuffer());
    if (!encodedAudio) return;
    const buffer = await context.decodeAudioData(encodedAudio.slice(0));
    const gain = context.createGain();
    const source = context.createBufferSource();
    gain.gain.value = sound ? .5 : 0;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(context.destination);
    officeAudioGainRef.current = gain;
    officeAudioSourceRef.current = source;
    source.start();
  }

  async function respawn() {
    if (officeStartedRef.current) return;
    officeStartedRef.current = true;
    clearPhaseTimers();
    setPhase("lamp");
    void startOfficeAmbience();
    const loop = loopRef.current;
    if (!loop) {
      phaseTimersRef.current = [window.setTimeout(() => {
        playEffect(monitorAudioRef);
        setPhase("office");
        setOnline(true);
      }, 1750)];
      return;
    }
    loop.currentTime = 0;
    let loopIsPlaying = false;
    try {
      await loop.play();
      loopIsPlaying = true;
    } catch {
      try {
        await loop.play();
        loopIsPlaying = true;
      } catch { /* The first loop frame remains visible. */ }
    }
    const revealRoom = () => {
      phaseTimersRef.current = [window.setTimeout(() => {
        playEffect(monitorAudioRef);
        setPhase("office");
        setOnline(true);
      }, 1750)];
    };
    if (loopIsPlaying && "requestVideoFrameCallback" in loop) loop.requestVideoFrameCallback(revealRoom);
    else requestAnimationFrame(revealRoom);
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    const context = officeAudioContextRef.current;
    const gain = officeAudioGainRef.current;
    if (context && gain) gain.gain.setTargetAtTime(next ? .5 : 0, context.currentTime, .025);
  }

  function openMonitor(id: MonitorId) {
    if (!online) return;
    playEffect(monitorOpenAudioRef);
    setFocus(id);
  }

  async function generateLarry() {
    if (generationState === "working") return;
    setGenerationState("working");
    try {
      const response = await fetch("/api/generate-larry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json() as { image?: string; mimeType?: string; presetName?: string; presetId?: string; error?: string };
      if (!response.ok || !result.image) throw new Error(result.error || "Summoning failed.");

      const id = Date.now();
      const extension = result.mimeType === "image/jpeg" ? "jpg" : "png";
      const presetName = result.presetName || "MYSTERY LARRY";
      const safePresetName = presetName.replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      const item: ArchiveItem = {
        id,
        name: `${safePresetName}_${String(id).slice(-4)}`,
        style: presetName,
        source: `data:${result.mimeType || "image/png"};base64,${result.image}`,
        tone: 4,
        reportedBy: "THE SUMMONING TERMINAL",
        threat: "FRESHLY SUMMONED",
        lastSeen: "INSIDE THE GENERATOR",
        fileExtension: extension,
      };
      setGeneratedSource(item.source);
      setGeneratedDownloadName(`${item.name}.${extension}`);
      setGeneratedPresetName(presetName);
      setArchiveItems((items) => [item, ...items]);
      setSelectedArchive(id);
      setPersonalGenerationCount((count) => count + 1);
      void savePersonalGeneration(item).catch(() => { /* The current result remains downloadable. */ });
      setGenerationState("ready");
    } catch {
      setGenerationState("error");
    }
  }

  const sceneStyle = {
    "--focus-x": focus === "left" ? "25%" : focus === "right" ? "75%" : "50%",
    "--focus-y": focus ? "61%" : "50%",
  } as CSSProperties;
  const activeApp = desktopApps.find((app) => app.id === selectedApp) || desktopApps[0];
  const activeArchive = archiveItems.find((item) => item.id === selectedArchive) || archiveItems[0];
  const activeArchiveExtension = activeArchive.fileExtension || activeArchive.source.split(".").pop() || "png";

  return (
    <main className={`night-shift phase-${phase} ${online ? "is-online" : ""} ${focus ? `focus-${focus}` : ""}`} style={sceneStyle}>
      <aside className="rotate-device" aria-label="Rotate your phone to landscape mode">
        <div className="rotate-phone" aria-hidden="true"><i /></div>
        <span>MOBILE SURVEILLANCE PROTOCOL</span>
        <strong>ROTATE YOUR DEVICE</strong>
        <p>TURN YOUR PHONE SIDEWAYS TO ENTER THE NIGHT SHIFT.</p>
      </aside>

      <svg className="screen-mask-defs" aria-hidden="true" focusable="false">
        <defs>
          {monitorIds.map((id) => (
            <clipPath id={`${id}-crt-mask`} clipPathUnits="objectBoundingBox" key={id}>
              <path d={makeMaskPath(screens[id])} />
            </clipPath>
          ))}
        </defs>
      </svg>

      <div className="scene-frame" aria-label="Evil Larry night surveillance room">
        <video ref={loopRef} className="room-video loop-video" src="/assets/video/looped.mp4" preload="auto" playsInline loop muted />

        {monitorIds.map((id) => {
          const config = screens[id];
          const bounds = boundsOf(config);
          const surfaceStyle = {
            left: `${bounds.left}%`,
            top: `${bounds.top}%`,
            width: `${bounds.width}%`,
            height: `${bounds.height}%`,
            "--screen-rotation": `${screenRotation(config)}deg`,
            "--content-scale": config.contentScale,
            "--screen-alpha": config.screenAlpha,
          } as CSSProperties;

          return (
            <button
              className={`monitor monitor-${id}`}
              key={id}
              type="button"
              aria-label={`Open ${monitorCopy[id].title}`}
              onClick={() => openMonitor(id)}
            >
              <span className="monitor-surface" style={surfaceStyle}>
                <span className="monitor-glass" />
                <span className="monitor-static" />
                <span className="monitor-ui">
                  <span className="monitor-code">{monitorCopy[id].code}</span>
                  {id === "center" ? (
                    <span className="mini-desktop" aria-hidden="true">
                      {desktopApps.slice(0, 6).map((app) => <i key={app.id}>{app.glyph}</i>)}
                    </span>
                  ) : id === "right" ? (
                    <span className="mini-archive" aria-hidden="true">
                      {initialArchive.slice(0, 4).map((item) => <i key={item.id} />)}
                    </span>
                  ) : (
                    <strong>{monitorCopy[id].title}</strong>
                  )}
                  <span className="monitor-prompt">[ CLICK TO OPEN ]</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="vhs-overlay" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      {phase !== "lamp" && phase !== "office" && (
        <section className={`cold-open cold-open-${phase}`} aria-live="polite">
          {initialized && (phase === "camera" || phase === "blackout") && (
            <div className={`camera-stage ${phase === "blackout" ? "is-powering-off" : ""}`}>
              <div className="camera-room-placeholder" aria-hidden="true" />
              <div className="camera-interface">
                <div className="camera-topline">
                  <span><i className="record-dot" /> REC&nbsp;&nbsp;00:02:18</span>
                </div>
                <div className="camera-mode">NIGHT VISION&nbsp;&nbsp;/&nbsp;&nbsp;AUTO</div>
                <div className="camera-bottomline"><span>CH 06</span><span>ISO 6400</span><span>F2.8</span></div>
              </div>
              {phase === "camera" && (
                <span className="battery-warning" aria-label="Camera battery depleted">
                  <i className="battery-shell"><i /></i>
                </span>
              )}
              <div className="camera-shutdown-flare" aria-hidden="true" />
            </div>
          )}

          {phase === "larry" && (
            <div className="larry-reveal" aria-label="Larry emerging from darkness">
              <img className="larry-layer larry-body-layer" src="/assets/larry-dark-plate-v1.png" alt="" />
              <img className="larry-layer larry-head-layer" src="/assets/larry-dark-plate-v1.png" alt="" />
              <img className="larry-layer larry-eye-layer larry-eye-left" src="/assets/larry-dark-plate-v1.png" alt="" />
              <img className="larry-layer larry-eye-layer larry-eye-right" src="/assets/larry-dark-plate-v1.png" alt="" />
              <div className="larry-light" />
              <div className="larry-impact" />
              <span className="larry-camera-code">UNKNOWN SUBJECT / 0.6M</span>
            </div>
          )}

          {phase === "died" && (
            <div className="death-screen">
              <div className="television-static" />
              <strong>YOU DIED</strong>
              <span>CAMERA SIGNAL TERMINATED</span>
            </div>
          )}

          {phase === "respawn" && (
            <div className="respawn-screen">
              <span>NIGHT SHIFT TERMINATED</span>
              <button type="button" onClick={respawn}>RESPAWN</button>
            </div>
          )}

          {!initialized && phase === "camera" && (
            <button className="camera-initialize" type="button" onClick={enableIntroAudio}>
              <span>CLICK ANYWHERE</span>
              <small>TO INITIALIZE CAMERA</small>
            </button>
          )}
        </section>
      )}

      <audio ref={batteryAudioRef} src="/assets/audio/battery-warning.mp3" preload="auto" />
      <audio ref={cameraOffAudioRef} src="/assets/audio/camera-power-off.mp3" preload="auto" />
      <audio ref={larryAudioRef} src="/assets/audio/larry-theme-synced.mp3" preload="auto" />
      <audio ref={deathAudioRef} src="/assets/audio/you-died-short.mp3" preload="auto" />
      <audio ref={monitorAudioRef} src="/assets/audio/monitor-power-on.mp3" preload="auto" />
      <audio ref={monitorOpenAudioRef} src="/assets/audio/monitor-open.wav" preload="auto" />

      <header className="hud hud-top" aria-hidden={!online}>
        <div><span className="status-dot" /> SYSTEM ONLINE</div>
        <div className="hud-title">LARRY SECURITY NETWORK</div>
        <time>12:06 AM</time>
      </header>

      <footer className="hud hud-bottom" aria-hidden={!online}>
        <button type="button" onClick={toggleSound}>SOUND: {sound ? "ON" : "OFF"}</button>
        <span>SELECT A MONITOR</span>
        <span>THREAT LEVEL: UNKNOWN</span>
      </footer>

      {focus && (
        <section className="focus-panel" aria-live="polite">
          <div className="focus-noise" aria-hidden="true" />
          <button className="back-button" type="button" onClick={() => setFocus(null)}>← RETURN TO OFFICE</button>
          <header className="module-heading">
            <div>
              <p>{monitorCopy[focus].code} / ONLINE</p>
              <h2>{monitorCopy[focus].title}</h2>
              <span>{monitorCopy[focus].detail}</span>
            </div>
            <small>SECURE NODE&nbsp;&nbsp;●</small>
          </header>

          {focus === "center" && (
            <div className="desktop-workspace">
              <div className="desktop-icons" aria-label="Larry OS applications">
                {desktopApps.map((app) => (
                  <button className={selectedApp === app.id ? "is-selected" : ""} type="button" key={app.id} onClick={() => setSelectedApp(app.id)}>
                    <i>{app.glyph}</i>
                    <span>{app.label}</span>
                  </button>
                ))}
              </div>
              <div className="system-window">
                <header><span>LARRY_OS / {activeApp.label}</span><i>□ ×</i></header>
                <div className="system-window-body">
                  {activeApp.id === "lore" ? (
                    <article className="lore-dossier">
                      <header>
                        <p>&gt; DECRYPTING LARRY.DAT</p>
                        <span>CLASSIFIED / EYES ONLY</span>
                      </header>
                      <div className="lore-hero">
                        <img src="/assets/larry-cosplay-reference.png" alt="Larry cosplay reference" />
                        <div>
                          <small>SUBJECT 001</small>
                          <h3>LARRY</h3>
                          <p>BLACK ORIENTAL SHORTHAIR<br />THREAT CLASS: UNDEFINED<br />CURRENT LOCATION: YOUR SCREEN</p>
                        </div>
                      </div>
                      <section>
                        <span>01 / THE ORIGIN</span>
                        <p>Larry surfaced in late 2024 through short scary-stories edits: an unnervingly direct stare, an ordinary room, and the feeling that the cat already knew who was watching. The internet gave him a name. The cameras gave him a way in.</p>
                      </section>
                      <section>
                        <span>02 / THE NIGHT-SHIFT FILE</span>
                        <p>Every confirmed encounter begins the same way. A security camera locks onto an empty room. The battery drains without warning. When the feed dies, Larry is no longer inside the recording — he is standing behind the camera. No operator has completed the shift without using the respawn terminal.</p>
                      </section>
                      <div className="incident-log">
                        <span><i>00:02:18</i> CAMERA SIGNAL ACQUIRED</span>
                        <span><i>00:02:19</i> BATTERY FAILURE DETECTED</span>
                        <span><i>00:02:21</i> UNKNOWN SUBJECT APPROACHING</span>
                        <span><i>00:02:24</i> OPERATOR STATUS: YOU DIED</span>
                      </div>
                      <section>
                        <span>03 / RECOVERED EVIDENCE</span>
                        <div className="lore-gallery">
                          <figure><img src="/assets/larry-evil.gif" alt="Evil Larry sighting" /><figcaption>EVIL FORM</figcaption></figure>
                          <figure><img src="/assets/larry-spooky.gif" alt="Spooky Larry sighting" /><figcaption>SPOOKY FORM</figcaption></figure>
                          <figure><img src="/assets/larry-dark-plate-v1.png" alt="Night-shift Larry sighting" /><figcaption>NIGHT-SHIFT FORM</figcaption></figure>
                        </div>
                      </section>
                      <blockquote>IF LARRY IS VISIBLE, HE HAS ALREADY SEEN YOU.</blockquote>
                    </article>
                  ) : (
                    <>
                      <p>&gt; OPENING {activeApp.id.toUpperCase()}.EXE</p>
                      <strong>{activeApp.detail}</strong>
                      <div className="system-lines"><i /><i /><i /></div>
                      <small>STATUS: STANDBY&nbsp;&nbsp;|&nbsp;&nbsp;ACCESS: PUBLIC</small>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {focus === "left" && (
            <div className="generator-workspace">
              <div className="generator-source">
                <div className="generator-preview">
                  <img src={generatedSource || "/assets/larry-cosplay-reference.png"} alt={generatedSource ? "Generated Larry avatar" : "Larry cosplay reference"} />
                  <span>{generatedSource ? "OUTPUT RECEIVED // LARRY" : "SUBJECT LOCKED // LARRY"}</span>
                </div>
                <small>THE SUBJECT AND GENERATION PROMPT ARE SYSTEM-LOCKED.</small>
              </div>
              <div className="generator-controls">
                <div className="random-larry-question">
                  <span>COSPLAY RANDOMIZER // LARRY PRESERVED</span>
                  <strong>WHICH COSPLAY DID LARRY CHOOSE?</strong>
                  <small>THE SYSTEM WILL INVENT A NEW COSPLAY AT RANDOM.</small>
                </div>
                <div className="locked-directive">
                  <span>LOCKED GENERATION DIRECTIVE</span>
                  <strong>ORIGINAL POSE + LIGHTING // SEAMLESS COSPLAY EDIT</strong>
                </div>
                <div className="generator-readout"><span>OUTPUT</span><strong>1:1 AVATAR / 1024 PX</strong></div>
                <div className="generator-readout"><span>MODEL</span><strong>NANO BANANA 2 LITE / 1K</strong></div>
                <button className="generate-action" type="button" onClick={generateLarry} disabled={generationState === "working"}>
                  {generationState === "working" ? "FINDING YOUR LARRY..." : generationState === "ready" ? "FIND ANOTHER LARRY" : "FIND MY LARRY"}
                </button>
                <small className="generator-status">
                  {generationState === "ready" ? `${generatedPresetName} // SAVED TO YOUR LOCAL ARCHIVE` : generationState === "error" ? "SIGNAL LOST // TRY AGAIN" : generationState === "working" ? "DESIGNING LARRY'S COSPLAY..." : "LARRY LOCKED // READY TO TRANSFORM"}
                </small>
                {generationState === "ready" && (
                  <div className="generator-result-actions">
                    <a href={generatedSource || undefined} download={generatedDownloadName}>DOWNLOAD OUTPUT ↓</a>
                    <button className="archive-jump" type="button" onClick={() => setFocus("right")}>VIEW IN ARCHIVES →</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {focus === "right" && (
            <div className="archive-workspace">
              <div className="archive-inspector">
                <div className={`archive-main-image archive-tone-${activeArchive.tone}`}>
                  <img src={activeArchive.source} alt={`${activeArchive.name} generated Larry portrait`} />
                </div>
                <div><span>CASE NAME</span><strong>{activeArchive.name}</strong></div>
                <div><span>OFFICIAL MOOD</span><strong>{activeArchive.style}</strong></div>
                <div><span>REPORTED BY</span>{activeArchive.sourceUrl ? <a href={activeArchive.sourceUrl} target="_blank" rel="noreferrer">{activeArchive.credit} ↗</a> : <strong>{activeArchive.reportedBy || "THE GROUP CHAT"}</strong>}</div>
                <div><span>THREAT LEVEL</span><strong>{activeArchive.threat || "MILDLY CONCERNING"}</strong></div>
                <div><span>LAST SEEN</span><strong>{activeArchive.lastSeen || "YOUR PERIPHERAL VISION"}</strong></div>
                <a href={activeArchive.source} download={`${activeArchive.name}.${activeArchiveExtension}`}>DOWNLOAD EVIDENCE</a>
              </div>
              <div className="archive-browser">
                <header><span>YOUR LOCAL ARCHIVE</span><small>{personalGenerationCount} PRIVATE / {initialArchive.length} RECOVERED</small></header>
                <div className="archive-grid">
                  {archiveItems.map((item) => (
                    <button className={selectedArchive === item.id ? "is-selected" : ""} type="button" key={item.id} onClick={() => setSelectedArchive(item.id)}>
                      <span className={`archive-thumb archive-tone-${item.tone}`}><img src={item.source} alt="" /></span>
                      <strong>{item.name}</strong>
                      <small>{item.style}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
