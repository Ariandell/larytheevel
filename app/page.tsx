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

const monitorIds: MonitorId[] = ["left", "center", "right"];
const cornerIds: CornerId[] = ["tl", "tr", "br", "bl"];

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
  left: { code: "GEN-01", title: "SUMMON LARRY", detail: "Portrait generator waiting for a subject." },
  center: { code: "CAM-06", title: "LIVE SURVEILLANCE", detail: "Central corridor feed. Motion status: unknown." },
  right: { code: "ARC-09", title: "THE ARCHIVES", detail: "Recovered footage, classified memes and sightings." },
};

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
  const officeStartedRef = useRef(false);
  const phaseTimersRef = useRef<number[]>([]);
  const [online, setOnline] = useState(false);
  const [phase, setPhase] = useState<IntroPhase>("camera");
  const [focus, setFocus] = useState<MonitorId | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    loopRef.current?.load();
    const larryPreload = new window.Image();
    larryPreload.src = "/assets/larry-dark-plate-v1.png";
    phaseTimersRef.current = [
      window.setTimeout(() => setPhase("blackout"), 2400),
      window.setTimeout(() => setPhase("larry"), 2800),
      window.setTimeout(() => setPhase("died"), 5350),
      window.setTimeout(() => setPhase("respawn"), 7050),
    ];
    return () => phaseTimersRef.current.forEach(window.clearTimeout);
  }, []);

  function clearPhaseTimers() {
    phaseTimersRef.current.forEach(window.clearTimeout);
    phaseTimersRef.current = [];
  }

  async function respawn() {
    if (officeStartedRef.current) return;
    officeStartedRef.current = true;
    clearPhaseTimers();
    setPhase("lamp");
    const loop = loopRef.current;
    if (!loop) {
      phaseTimersRef.current = [window.setTimeout(() => {
        setPhase("office");
        setOnline(true);
      }, 1750)];
      return;
    }
    loop.currentTime = 0;
    loop.muted = !sound;
    let loopIsPlaying = false;
    try {
      await loop.play();
      loopIsPlaying = true;
    } catch {
      loop.muted = true;
      try {
        await loop.play();
        loopIsPlaying = true;
      } catch { /* The first loop frame remains visible. */ }
    }
    const revealRoom = () => {
      phaseTimersRef.current = [window.setTimeout(() => {
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
    if (loopRef.current) loopRef.current.muted = !next;
  }

  const sceneStyle = {
    "--focus-x": focus === "left" ? "25%" : focus === "right" ? "75%" : "50%",
    "--focus-y": focus ? "61%" : "50%",
  } as CSSProperties;

  return (
    <main className={`night-shift phase-${phase} ${online ? "is-online" : ""} ${focus ? `focus-${focus}` : ""}`} style={sceneStyle}>
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
        <video ref={loopRef} className="room-video loop-video" src="/assets/looped.mp4" preload="auto" playsInline loop muted={!sound} />

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
              onClick={() => online && setFocus(id)}
            >
              <span className="monitor-surface" style={surfaceStyle}>
                <span className="monitor-glass" />
                <span className="monitor-static" />
                <span className="monitor-ui">
                  <span className="monitor-code">{monitorCopy[id].code}</span>
                  <strong>{monitorCopy[id].title}</strong>
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
          {(phase === "camera" || phase === "blackout") && (
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
        </section>
      )}

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
          <p>{monitorCopy[focus].code} / ONLINE</p>
          <h2>{monitorCopy[focus].title}</h2>
          <span>{monitorCopy[focus].detail}</span>
          <div className="focus-placeholder">
            <span>MODULE PREVIEW</span>
            <strong>{focus === "center" ? "NO MOVEMENT DETECTED" : "AWAITING CONNECTION"}</strong>
          </div>
        </section>
      )}
    </main>
  );
}
