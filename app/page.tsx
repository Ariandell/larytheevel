"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";

type MonitorId = "left" | "center" | "right";
type MonitorConfig = {
  x: number;
  y: number;
  width: number;
  height: number;
  curveX: number;
  curveY: number;
  slant: number;
  perspective: number;
  skew: number;
  contentScale: number;
  screenAlpha: number;
};
type ScreenConfigs = Record<MonitorId, MonitorConfig>;
type NumericConfigKey = keyof MonitorConfig;

const STORAGE_KEY = "evil-larry-screen-calibration-v1";
const monitorIds: MonitorId[] = ["left", "center", "right"];
const defaultScreens: ScreenConfigs = {
  left: { x: 18.15, y: 56.2, width: 12.3, height: 16.1, curveX: 8, curveY: 8, slant: 1.5, perspective: 5, skew: 1, contentScale: 1, screenAlpha: .24 },
  center: { x: 44, y: 48.25, width: 13.7, height: 18.15, curveX: 8, curveY: 5, slant: 0, perspective: 0, skew: 0, contentScale: 1, screenAlpha: .24 },
  right: { x: 70.05, y: 56.25, width: 11.55, height: 15.9, curveX: 6, curveY: 7, slant: -1.5, perspective: -5, skew: -1, contentScale: 1, screenAlpha: .24 },
};

const monitorCopy: Record<MonitorId, { code: string; title: string; detail: string }> = {
  left: { code: "GEN-01", title: "SUMMON LARRY", detail: "Portrait generator waiting for a subject." },
  center: { code: "CAM-06", title: "LIVE SURVEILLANCE", detail: "Central corridor feed. Motion status: unknown." },
  right: { code: "ARC-09", title: "THE ARCHIVES", detail: "Recovered footage, classified memes and sightings." },
};

const calibrationControls: Array<{ key: NumericConfigKey; label: string; min: number; max: number; step: number; suffix?: string }> = [
  { key: "x", label: "Position X", min: 0, max: 88, step: .05, suffix: "%" },
  { key: "y", label: "Position Y", min: 0, max: 88, step: .05, suffix: "%" },
  { key: "width", label: "Width", min: 5, max: 30, step: .05, suffix: "%" },
  { key: "height", label: "Height", min: 5, max: 35, step: .05, suffix: "%" },
  { key: "curveX", label: "Horizontal curve", min: 0, max: 20, step: .25, suffix: "%" },
  { key: "curveY", label: "Vertical curve", min: 0, max: 20, step: .25, suffix: "%" },
  { key: "slant", label: "Side slant", min: -10, max: 10, step: .25, suffix: "%" },
  { key: "perspective", label: "Perspective", min: -15, max: 15, step: .25, suffix: "°" },
  { key: "skew", label: "Text skew", min: -8, max: 8, step: .25, suffix: "°" },
  { key: "contentScale", label: "Content scale", min: .65, max: 1.35, step: .01 },
  { key: "screenAlpha", label: "Screen opacity", min: 0, max: .8, step: .01 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeMaskPath(config: MonitorConfig) {
  const cx = clamp(config.curveX / 100, 0, .25);
  const cy = clamp(config.curveY / 100, 0, .25);
  const slant = clamp(config.slant / 100, -.15, .15);
  const topLeft = clamp(cx + slant, 0, .35);
  const topRight = clamp(1 - cx + slant, .65, 1);
  const bottomRight = clamp(1 - cx - slant, .65, 1);
  const bottomLeft = clamp(cx - slant, 0, .35);

  return `M ${topLeft} ${cy} C .32 0 .68 0 ${topRight} ${cy} C 1 .3 1 .7 ${bottomRight} ${1 - cy} C .68 1 .32 1 ${bottomLeft} ${1 - cy} C 0 .7 0 .3 ${topLeft} ${cy} Z`;
}

export default function Home() {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(false);
  const [focus, setFocus] = useState<MonitorId | null>(null);
  const [sound, setSound] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [activeMonitor, setActiveMonitor] = useState<MonitorId>("center");
  const [screens, setScreens] = useState<ScreenConfigs>(defaultScreens);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loopRef.current?.load();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setScreens({ ...defaultScreens, ...JSON.parse(saved) });
    } catch {
      // Invalid local calibration is ignored and defaults remain active.
    }
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
      try { await loop.play(); } catch { /* The still frame remains usable for calibration. */ }
    }
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
    setScreens((current) => ({ ...current, [activeMonitor]: { ...defaultScreens[activeMonitor] } }));
    setNotice("CURRENT SCREEN RESET");
  }

  function resetAll() {
    setScreens(structuredClone(defaultScreens));
    window.localStorage.removeItem(STORAGE_KEY);
    setNotice("ALL SCREENS RESET");
  }

  const sceneStyle = {
    "--focus-x": focus === "left" ? "25%" : focus === "right" ? "75%" : "50%",
    "--focus-y": focus ? "61%" : "50%",
  } as CSSProperties;

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

      <div className="scene-frame" aria-label="Evil Larry night surveillance room">
        <video ref={loopRef} className="room-video loop-video" src="/assets/looped.mp4" preload="auto" playsInline loop muted />
        <video ref={introRef} className="room-video intro-video" src="/assets/intro.mp4" preload="auto" playsInline muted onEnded={handoffToLoop} />

        {monitorIds.map((id) => {
          const config = screens[id];
          const monitorStyle = {
            left: `${config.x}%`,
            top: `${config.y}%`,
            width: `${config.width}%`,
            height: `${config.height}%`,
            "--screen-perspective": `${config.perspective}deg`,
            "--screen-skew": `${config.skew}deg`,
            "--content-scale": config.contentScale,
            "--screen-alpha": config.screenAlpha,
          } as CSSProperties;

          return (
            <button
              className={`monitor monitor-${id} ${calibrationOpen && activeMonitor === id ? "is-calibration-target" : ""}`}
              key={id}
              type="button"
              style={monitorStyle}
              aria-label={calibrationOpen ? `Calibrate ${id} monitor` : `Open ${monitorCopy[id].title}`}
              onClick={() => calibrationOpen ? setActiveMonitor(id) : online && setFocus(id)}
            >
              <span className="monitor-glass" />
              <span className="monitor-static" />
              <span className="monitor-ui">
                <span className="monitor-code">{monitorCopy[id].code}</span>
                <strong>{monitorCopy[id].title}</strong>
                <span className="monitor-prompt">{calibrationOpen ? "[ SELECTED FOR CALIBRATION ]" : "[ CLICK TO OPEN ]"}</span>
              </span>
            </button>
          );
        })}
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
        <aside className="calibration-panel" aria-label="Screen calibration controls">
          <header>
            <div>
              <p>LIVE SCREEN EDITOR</p>
              <h2>CALIBRATION</h2>
            </div>
            <button type="button" onClick={() => setCalibrationOpen(false)} aria-label="Close calibration">×</button>
          </header>

          <nav className="monitor-tabs" aria-label="Choose a monitor">
            {monitorIds.map((id) => (
              <button className={activeMonitor === id ? "active" : ""} type="button" key={id} onClick={() => setActiveMonitor(id)}>
                {id.toUpperCase()}
              </button>
            ))}
          </nav>

          <p className="calibration-hint">Select a screen, then fit its glowing outline to the CRT glass.</p>

          <div className="calibration-controls">
            {calibrationControls.map((control) => {
              const value = screens[activeMonitor][control.key];
              return (
                <label key={control.key}>
                  <span>{control.label}<output>{value.toFixed(control.step < .1 ? 2 : 1)}{control.suffix}</output></span>
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

          <div className="calibration-buttons">
            <button type="button" onClick={saveCalibration}>SAVE LOCAL</button>
            <button type="button" onClick={copyCalibration}>COPY CONFIG</button>
            <button type="button" onClick={resetActive}>RESET SCREEN</button>
            <button type="button" onClick={resetAll}>RESET ALL</button>
          </div>
          <p className="calibration-notice">{notice || "Settings are stored only in your browser."}</p>
        </aside>
      )}
    </main>
  );
}
