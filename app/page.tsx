"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";

type MonitorId = "left" | "center" | "right";

const monitorCopy: Record<MonitorId, { code: string; title: string; detail: string }> = {
  left: { code: "GEN-01", title: "SUMMON LARRY", detail: "Portrait generator waiting for a subject." },
  center: { code: "CAM-06", title: "LIVE SURVEILLANCE", detail: "Central corridor feed. Motion status: unknown." },
  right: { code: "ARC-09", title: "THE ARCHIVES", detail: "Recovered footage, classified memes and sightings." },
};

export default function Home() {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(false);
  const [focus, setFocus] = useState<MonitorId | null>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => { loopRef.current?.load(); }, []);

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

  function toggleSound() {
    const next = !sound;
    setSound(next);
    if (introRef.current) introRef.current.muted = !next;
    if (loopRef.current) loopRef.current.muted = !next;
  }

  const sceneStyle = {
    "--focus-x": focus === "left" ? "25%" : focus === "right" ? "75%" : "50%",
    "--focus-y": focus ? "61%" : "50%",
  } as CSSProperties;

  return (
    <main className={`night-shift ${started ? "has-started" : ""} ${online ? "is-online" : ""} ${focus ? `focus-${focus}` : ""}`} style={sceneStyle}>
      <svg className="screen-mask-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="left-crt-mask" clipPathUnits="objectBoundingBox">
            <path d="M .08 .08 C .3 .02 .7 0 .94 .07 C .99 .28 .99 .75 .93 .93 C .7 .99 .32 1 .06 .96 C .01 .76 .01 .28 .08 .08 Z" />
          </clipPath>
          <clipPath id="center-crt-mask" clipPathUnits="objectBoundingBox">
            <path d="M .08 .05 C .32 0 .68 0 .92 .05 C .99 .24 1 .76 .92 .95 C .68 1 .32 1 .08 .95 C .01 .76 0 .24 .08 .05 Z" />
          </clipPath>
          <clipPath id="right-crt-mask" clipPathUnits="objectBoundingBox">
            <path d="M .06 .07 C .3 0 .7 .02 .92 .08 C .99 .28 .99 .76 .94 .96 C .68 1 .3 .99 .07 .93 C .01 .75 .01 .28 .06 .07 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="scene-frame" aria-label="Evil Larry night surveillance room">
        <video ref={loopRef} className="room-video loop-video" src="/assets/looped.mp4" preload="auto" playsInline loop muted />
        <video ref={introRef} className="room-video intro-video" src="/assets/intro.mp4" preload="auto" playsInline muted onEnded={handoffToLoop} />

        {(["left", "center", "right"] as MonitorId[]).map((id) => (
          <button className={`monitor monitor-${id}`} key={id} type="button" aria-label={`Open ${monitorCopy[id].title}`} onClick={() => online && setFocus(id)}>
            <span className="monitor-glass" />
            <span className="monitor-static" />
            <span className="monitor-ui">
              <span className="monitor-code">{monitorCopy[id].code}</span>
              <strong>{monitorCopy[id].title}</strong>
              <span className="monitor-prompt">[ CLICK TO OPEN ]</span>
            </span>
          </button>
        ))}
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
