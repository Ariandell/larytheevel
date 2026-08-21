"use client";

import {
  CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type MonitorId = "left" | "center" | "right";
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
type CurveConfigKey = "curveTop" | "curveRight" | "curveBottom" | "curveLeft";
type NumericConfigKey = CurveConfigKey | "contentScale" | "screenAlpha";
type DragState = {
  id: MonitorId;
  mode: "move" | "corner" | "curve";
  corner?: CornerId;
  side?: SideId;
  startX: number;
  startY: number;
  config: MonitorConfig;
};

const STORAGE_KEY = "evil-larry-screen-calibration-v3";
const monitorIds: MonitorId[] = ["left", "center", "right"];
const cornerIds: CornerId[] = ["tl", "tr", "br", "bl"];
const sideIds: SideId[] = ["top", "right", "bottom", "left"];

const defaultScreens: ScreenConfigs = {
  left: {
    corners: {
      tl: { x: 19.1, y: 57.4 },
      tr: { x: 29.6, y: 57.2 },
      br: { x: 29.45, y: 71.15 },
      bl: { x: 18.9, y: 71.25 },
    },
    curveTop: 8,
    curveRight: 8,
    curveBottom: 8,
    curveLeft: 8,
    contentScale: 1,
    screenAlpha: .24,
  },
  center: {
    corners: {
      tl: { x: 45.1, y: 49.15 },
      tr: { x: 56.6, y: 49.15 },
      br: { x: 56.6, y: 65.5 },
      bl: { x: 45.1, y: 65.5 },
    },
    curveTop: 6,
    curveRight: 8,
    curveBottom: 6,
    curveLeft: 8,
    contentScale: 1,
    screenAlpha: .24,
  },
  right: {
    corners: {
      tl: { x: 70.7, y: 57.35 },
      tr: { x: 80.65, y: 57.45 },
      br: { x: 81.05, y: 71.05 },
      bl: { x: 70.85, y: 71.1 },
    },
    curveTop: 8,
    curveRight: 8,
    curveBottom: 8,
    curveLeft: 8,
    contentScale: 1,
    screenAlpha: .24,
  },
};

const monitorCopy: Record<MonitorId, { code: string; title: string; detail: string }> = {
  left: { code: "GEN-01", title: "SUMMON LARRY", detail: "Portrait generator waiting for a subject." },
  center: { code: "CAM-06", title: "LIVE SURVEILLANCE", detail: "Central corridor feed. Motion status: unknown." },
  right: { code: "ARC-09", title: "THE ARCHIVES", detail: "Recovered footage, classified memes and sightings." },
};

const calibrationControls: Array<{ key: NumericConfigKey; label: string; min: number; max: number; step: number }> = [
  { key: "curveTop", label: "Top bend", min: -40, max: 40, step: .25 },
  { key: "curveRight", label: "Right bend", min: -40, max: 40, step: .25 },
  { key: "curveBottom", label: "Bottom bend", min: -40, max: 40, step: .25 },
  { key: "curveLeft", label: "Left bend", min: -40, max: 40, step: .25 },
  { key: "contentScale", label: "Content scale", min: .65, max: 1.35, step: .01 },
  { key: "screenAlpha", label: "Screen opacity", min: 0, max: .8, step: .01 },
];

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function curveGeometry(config: MonitorConfig) {
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
  return { tl, tr, br, bl, top1, top2, right1, right2, bottom1, bottom2, left1, left2, strengths, averageWidth, averageHeight };
}

function makeScreenPath(config: MonitorConfig, normalized: boolean) {
  const { tl, tr, br, bl, top1, top2, right1, right2, bottom1, bottom2, left1, left2 } = curveGeometry(config);
  const n = (value: number) => normalized ? (value / 100).toFixed(5) : value.toFixed(3);

  return [
    `M ${n(tl.x)} ${n(tl.y)}`,
    `C ${n(top1.x)} ${n(top1.y)} ${n(top2.x)} ${n(top2.y)} ${n(tr.x)} ${n(tr.y)}`,
    `C ${n(right1.x)} ${n(right1.y)} ${n(right2.x)} ${n(right2.y)} ${n(br.x)} ${n(br.y)}`,
    `C ${n(bottom1.x)} ${n(bottom1.y)} ${n(bottom2.x)} ${n(bottom2.y)} ${n(bl.x)} ${n(bl.y)}`,
    `C ${n(left1.x)} ${n(left1.y)} ${n(left2.x)} ${n(left2.y)} ${n(tl.x)} ${n(tl.y)} Z`,
  ].join(" ");
}

function makeMaskPath(config: MonitorConfig) {
  return makeScreenPath(config, true);
}

function sideEdge(config: MonitorConfig, side: SideId): [Point, Point] {
  const { tl, tr, br, bl } = config.corners;
  if (side === "top") return [tl, tr];
  if (side === "right") return [tr, br];
  if (side === "bottom") return [br, bl];
  return [bl, tl];
}

function sideHandlePoint(config: MonitorConfig, side: SideId): Point {
  const [a, b] = sideEdge(config, side);
  const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: dy / length, y: -dx / length };
  const strength = curveGeometry(config).strengths[side];
  return {
    x: midpoint.x + normal.x * strength * .75,
    y: midpoint.y + normal.y * strength * .75,
  };
}

export default function Home() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(false);
  const [focus, setFocus] = useState<MonitorId | null>(null);
  const [sound, setSound] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorId>("center");
  const [screens, setScreens] = useState<ScreenConfigs>(defaultScreens);
  const [notice, setNotice] = useState("");
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");

  useEffect(() => {
    loopRef.current?.load();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setScreens({ ...defaultScreens, ...JSON.parse(saved) });
    } catch {
      // Invalid local calibration is ignored and defaults remain active.
    }
  }, []);

  useEffect(() => {
    function movePointer(event: PointerEvent) {
      const drag = dragRef.current;
      const frame = sceneRef.current;
      if (!drag || !frame) return;

      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const dx = (event.clientX - drag.startX) / rect.width * 100;
      const dy = (event.clientY - drag.startY) / rect.height * 100;
      const next = cloneConfig(drag.config);

      if (drag.mode === "move") {
        cornerIds.forEach((corner) => {
          next.corners[corner].x = clamp(drag.config.corners[corner].x + dx, 0, 100);
          next.corners[corner].y = clamp(drag.config.corners[corner].y + dy, 0, 100);
        });
      }

      if (drag.mode === "corner" && drag.corner) {
        next.corners[drag.corner] = {
          x: clamp(drag.config.corners[drag.corner].x + dx, 0, 100),
          y: clamp(drag.config.corners[drag.corner].y + dy, 0, 100),
        };
      }

      if (drag.mode === "curve" && drag.side) {
        const pointer = {
          x: (event.clientX - rect.left) / rect.width * 100,
          y: (event.clientY - rect.top) / rect.height * 100,
        };
        const [a, b] = sideEdge(drag.config, drag.side);
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const edgeX = b.x - a.x;
        const edgeY = b.y - a.y;
        const edgeLength = Math.hypot(edgeX, edgeY) || 1;
        const normal = { x: edgeY / edgeLength, y: -edgeX / edgeLength };
        const projection = (pointer.x - midpoint.x) * normal.x + (pointer.y - midpoint.y) * normal.y;
        const geometry = curveGeometry(drag.config);
        const base = drag.side === "top" || drag.side === "bottom" ? geometry.averageHeight : geometry.averageWidth;
        const key = `curve${drag.side[0].toUpperCase()}${drag.side.slice(1)}` as CurveConfigKey;
        next[key] = clamp(projection / (.75 * base) * 100, -40, 40);
      }

      setScreens((current) => ({ ...current, [drag.id]: next }));
      setNotice("");
    }

    function stopPointer() {
      dragRef.current = null;
      document.body.classList.remove("is-transforming-screen");
    }

    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", stopPointer);
    window.addEventListener("pointercancel", stopPointer);
    return () => {
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", stopPointer);
      window.removeEventListener("pointercancel", stopPointer);
    };
  }, []);

  async function startScene() {
    const intro = introRef.current;
    if (!intro || started) return;
    setStarted(true);
    intro.muted = !sound;
    try { await intro.play(); } catch { intro.muted = true; await intro.play(); }
  }

  async function handoffToLoop() {
    const loop = loopRef.current;
    if (!loop) { setOnline(true); return; }
    loop.currentTime = 0;
    loop.muted = !sound;
    try { await loop.play(); } catch { loop.muted = true; await loop.play(); }
    const reveal = () => setOnline(true);
    if ("requestVideoFrameCallback" in loop) loop.requestVideoFrameCallback(reveal);
    else requestAnimationFrame(reveal);
  }

  async function openCalibration() {
    setFocus(null);
    setStarted(true);
    setOnline(true);
    setCalibrationOpen(true);
    introRef.current?.pause();
    const loop = loopRef.current;
    if (loop && loop.paused) {
      loop.muted = true;
      try { await loop.play(); } catch { /* The still frame remains usable. */ }
    }
  }

  function beginTransform(
    event: ReactPointerEvent,
    id: MonitorId,
    mode: DragState["mode"],
    corner?: CornerId,
    side?: SideId,
  ) {
    if (!calibrationOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setActiveMonitor(id);
    const frame = sceneRef.current;
    if (!frame) return;
    const config = cloneConfig(screens[id]);
    dragRef.current = {
      id,
      mode,
      corner,
      side,
      startX: event.clientX,
      startY: event.clientY,
      config,
    };
    document.body.classList.add("is-transforming-screen");
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    if (introRef.current) introRef.current.muted = !next;
    if (loopRef.current) loopRef.current.muted = !next;
  }

  function updateActive(key: NumericConfigKey, value: number) {
    setScreens((current) => ({
      ...current,
      [activeMonitor]: { ...current[activeMonitor], [key]: value },
    }));
    setNotice("");
  }

  function saveCalibration() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
    setNotice("SAVED IN THIS BROWSER");
  }

  async function copyCalibration() {
    await navigator.clipboard.writeText(JSON.stringify(screens, null, 2));
    setNotice("CONFIG COPIED");
  }

  function resetActive() {
    setScreens((current) => ({ ...current, [activeMonitor]: cloneConfig(defaultScreens[activeMonitor]) }));
    setNotice("CURRENT SCREEN RESET");
  }

  function resetAll() {
    setScreens(cloneConfig(defaultScreens));
    window.localStorage.removeItem(STORAGE_KEY);
    setNotice("ALL SCREENS RESET");
  }

  const sceneStyle = {
    "--focus-x": focus === "left" ? "25%" : focus === "right" ? "75%" : "50%",
    "--focus-y": focus ? "61%" : "50%",
  } as CSSProperties;
  const activeConfig = screens[activeMonitor];

  return (
    <main className={`night-shift ${started ? "has-started" : ""} ${online ? "is-online" : ""} ${focus ? `focus-${focus}` : ""} ${calibrationOpen ? "is-calibrating" : ""}`} style={sceneStyle}>
      <svg className="screen-mask-defs" aria-hidden="true" focusable="false">
        <defs>
          {monitorIds.map((id) => (
            <clipPath id={`${id}-crt-mask`} clipPathUnits="objectBoundingBox" key={id}>
              <path d={makeMaskPath(screens[id])} />
            </clipPath>
          ))}
        </defs>
      </svg>

      <div ref={sceneRef} className="scene-frame" aria-label="Evil Larry night surveillance room">
        <video ref={loopRef} className="room-video loop-video" src="/assets/looped.mp4" preload="auto" playsInline loop muted />
        <video ref={introRef} className="room-video intro-video" src="/assets/intro.mp4" preload="auto" playsInline muted onEnded={handoffToLoop} />

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
              className={`monitor monitor-${id} ${calibrationOpen && activeMonitor === id ? "is-calibration-target" : ""}`}
              key={id}
              type="button"
              aria-label={calibrationOpen ? `Move ${id} monitor mask` : `Open ${monitorCopy[id].title}`}
              onClick={() => calibrationOpen ? setActiveMonitor(id) : online && setFocus(id)}
              onPointerDown={(event) => calibrationOpen && activeMonitor === id && beginTransform(event, id, "move")}
            >
              <span className="monitor-surface" style={surfaceStyle}>
                <span className="monitor-glass" />
                <span className="monitor-static" />
                <span className="monitor-ui">
                  <span className="monitor-code">{monitorCopy[id].code}</span>
                  <strong>{monitorCopy[id].title}</strong>
                  <span className="monitor-prompt">{calibrationOpen ? "[ DRAG SCREEN TO MOVE ]" : "[ CLICK TO OPEN ]"}</span>
                </span>
              </span>
            </button>
          );
        })}

        {calibrationOpen && (
          <div className="transform-layer" aria-label={`Transform ${activeMonitor} monitor`}>
            <svg className="transform-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={makeScreenPath(activeConfig, false)} vectorEffect="non-scaling-stroke" />
            </svg>
            {cornerIds.map((corner) => (
              <button
                className="transform-handle corner-handle"
                key={corner}
                type="button"
                style={{ left: `${activeConfig.corners[corner].x}%`, top: `${activeConfig.corners[corner].y}%` }}
                aria-label={`Drag ${corner} corner`}
                onPointerDown={(event) => beginTransform(event, activeMonitor, "corner", corner)}
              />
            ))}
            {sideIds.map((side) => {
              const point = sideHandlePoint(activeConfig, side);
              return (
                <button
                  className={`transform-handle side-handle side-${side}`}
                  key={side}
                  type="button"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  aria-label={`Bend ${side} edge`}
                  onPointerDown={(event) => beginTransform(event, activeMonitor, "curve", undefined, side)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="vhs-overlay" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      {!started && (
        <section className="entry-panel">
          <p className="eyebrow">NIGHT SURVEILLANCE UNIT / 06</p>
          <h1>EVIL LARRY</h1>
          <p className="entry-copy">The room is still. The cameras are not.</p>
          <button className="enter-button" type="button" onClick={startScene}>
            <span>BEGIN NIGHT SHIFT</span><small>ENTER</small>
          </button>
          <button className="calibration-shortcut" type="button" onClick={openCalibration}>SKIP TO SCREEN CALIBRATION</button>
        </section>
      )}

      <header className="hud hud-top" aria-hidden={!online}>
        <div><span className="status-dot" /> SYSTEM ONLINE</div>
        <div className="hud-title">LARRY SECURITY NETWORK</div>
        <time>12:06 AM</time>
      </header>

      <footer className="hud hud-bottom" aria-hidden={!online}>
        <div className="hud-actions">
          <button type="button" onClick={toggleSound}>SOUND: {sound ? "ON" : "OFF"}</button>
          <button type="button" onClick={openCalibration}>CALIBRATE SCREENS</button>
        </div>
        <span>SELECT A MONITOR</span>
        <span>THREAT LEVEL: UNKNOWN</span>
      </footer>

      {focus && !calibrationOpen && (
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

      {calibrationOpen && (
        <aside className={`calibration-panel dock-${panelSide}`} aria-label="Screen calibration controls">
          <header>
            <div>
              <p>FREE WARP MODE</p>
              <h2>CALIBRATION</h2>
            </div>
            <div className="panel-window-actions">
              <button type="button" onClick={() => setPanelSide((side) => side === "right" ? "left" : "right")} aria-label="Move panel to other side">⇆</button>
              <button type="button" onClick={() => setCalibrationOpen(false)} aria-label="Close calibration">×</button>
            </div>
          </header>

          <nav className="monitor-tabs" aria-label="Choose a monitor">
            {monitorIds.map((id) => (
              <button className={activeMonitor === id ? "active" : ""} type="button" key={id} onClick={() => setActiveMonitor(id)}>
                {id.toUpperCase()}
              </button>
            ))}
          </nav>

          <div className="direct-manipulation-help">
            <span><i className="help-corner" /> Drag corners to warp</span>
            <span><i className="help-curve" /> Drag side handles to bend</span>
            <span><i className="help-move" /> Drag inside to move</span>
          </div>

          <details className="advanced-controls">
            <summary>ADVANCED SCREEN CURVE</summary>
            <div className="calibration-controls">
              {calibrationControls.map((control) => {
                const value = screens[activeMonitor][control.key];
                return (
                  <label key={control.key}>
                    <span>{control.label}<output>{value.toFixed(control.step < .1 ? 2 : 1)}</output></span>
                    <input
                      type="range"
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={value}
                      onChange={(event) => updateActive(control.key, Number(event.target.value))}
                    />
                  </label>
                );
              })}
            </div>
          </details>

          <div className="calibration-buttons">
            <button type="button" onClick={saveCalibration}>SAVE LOCAL</button>
            <button type="button" onClick={copyCalibration}>COPY CONFIG</button>
            <button type="button" onClick={resetActive}>RESET SCREEN</button>
            <button type="button" onClick={resetAll}>RESET ALL</button>
          </div>
          <p className="calibration-notice">{notice || "Drag the frame directly. Settings stay in this browser."}</p>
        </aside>
      )}
    </main>
  );
}
