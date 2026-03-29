import React, { useEffect, useRef, useState } from "react";

/* ===================== CONFIG ===================== */
const BRAND = {
  bg: "#0B1A2B",
  card: "#132B45",
  accent: "#FFD700",
  accent2: "#00E0FF",
};

/* ===================== HELPERS ===================== */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

function getAngle(A, B, C) {
  const AB = { x: A.x - B.x, y: A.y - B.y };
  const CB = { x: C.x - B.x, y: C.y - B.y };
  const dot = AB.x * CB.x + AB.y * CB.y;
  const magAB = Math.hypot(AB.x, AB.y);
  const magCB = Math.hypot(CB.x, CB.y);
  return Math.acos(clamp(dot / (magAB * magCB + 1e-6), -1, 1)) * 180 / Math.PI;
}

function angleToVertical(A, B) {
  return Math.atan2(B.x - A.x, B.y - A.y) * 180 / Math.PI;
}

/* ===================== APP ===================== */
export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [phase, setPhase] = useState("Esperando...");
  const [spm, setSpm] = useState(0);
  const [power, setPower] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState([]);

  const strokeRef = useRef([]);
  const timesRef = useRef([]);

  /* ===================== VIDEO ===================== */
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoSrc(URL.createObjectURL(file));
    strokeRef.current = [];
    timesRef.current = [];
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  /* ===================== AI ===================== */
  function finalizeStroke(stroke) {
    if (stroke.length < 10) return;

    const kneeRange =
      Math.max(...stroke.map(s => s.knee)) -
      Math.min(...stroke.map(s => s.knee));

    const powerVal = Math.round(kneeRange * 1.5);
    const timing = stroke.length;
    const finalScore = clamp(powerVal + timing, 0, 100);

    setPower(powerVal);
    setScore(finalScore);

    const fb = [];
    if (kneeRange < 30) fb.push("Poca extensión de piernas");
    if (powerVal < 40) fb.push("Falta potencia");
    if (timing < 15) fb.push("Drive muy corto");

    setFeedback(fb);
  }

  /* ===================== POSE ===================== */
  useEffect(() => {
    if (!videoSrc || !window.Pose) return;

    const pose = new window.Pose({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
    });

    pose.onResults(res => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

      if (!res.poseLandmarks) return;

      const lm = res.poseLandmarks;

      const hip = lm[24];
      const knee = lm[26];
      const ankle = lm[28];
      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];

      const kneeAngle = getAngle(hip, knee, ankle);
      const trunk = angleToVertical(hip, shoulder);
      const elbowAngle = getAngle(shoulder, elbow, wrist);

      strokeRef.current.push({ knee: kneeAngle });

      /* fases */
      if (kneeAngle < 80) setPhase("Catch");
      else if (kneeAngle > 120) setPhase("Drive");

      /* detectar stroke */
      if (kneeAngle < 80 && strokeRef.current.length > 15) {
        finalizeStroke(strokeRef.current);
        strokeRef.current = [];

        timesRef.current.push(Date.now());
        if (timesRef.current.length > 5) {
          const dt =
            timesRef.current[timesRef.current.length - 1] -
            timesRef.current[0];
          const s = timesRef.current.length;
          setSpm(Math.round((s / dt) * 60000));
        }
      }

      /* stickman */
      const draw = (a, b) => {
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = BRAND.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
      };

      draw(shoulder, elbow);
      draw(elbow, wrist);
      draw(shoulder, hip);
      draw(hip, knee);
      draw(knee, ankle);
    });

    const video = videoRef.current;

    video.onloadeddata = () => {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const loop = async () => {
        if (video.paused) return;
        await pose.send({ image: video });
        requestAnimationFrame(loop);
      };

      video.play();
      setIsPlaying(true);
      loop();
    };
  }, [videoSrc]);

  /* ===================== UI ===================== */
  return (
    <div style={{ background: BRAND.bg }} className="min-h-screen text-white">

      {/* LOGO */}
      <img src="/logo.png" className="absolute top-4 right-4 w-16" />

      {/* HEADER */}
<div className="text-center pt-10">
  <h1
    style={{ color: BRAND.accent }}
    className="text-3xl md:text-5xl font-bold tracking-wide"
  >
    ROWXIA
  </h1>

  <p className="text-white/60 mt-2 text-sm md:text-base">
    AI Rowing Analysis · Understand your stroke
  </p>
</div>

      {/* UPLOAD */}
      {!videoSrc && (
        <div className="text-center mt-10">
          <input type="file" accept="video/*" onChange={handleUpload} />
        </div>
      )}

      {/* VIDEO */}
      {videoSrc && (
        <>
         <div className="w-full max-w-4xl mx-auto mt-6">
  <canvas
    ref={canvasRef}
    className="w-full h-auto rounded-2xl shadow-2xl bg-black"
  />
</div>
          <video ref={videoRef} src={videoSrc} className="hidden" />

          <div className="flex justify-center gap-4 mt-4">
            <button onClick={togglePlay}className="bg-yellow-400 text-black px-5 py-2 rounded-xl font-semibold shadow hover:scale-105 transition"
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>

          {/* METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Card title="Score" value={score} />
            <Card title="SPM" value={spm} />
            <Card title="Power" value={power} />
            <Card title="Phase" value={phase} />
          </div>

          {/* FEEDBACK */}
        <div className="mt-6">
  <div
    style={{ background: BRAND.card }}
    className="p-4 rounded-2xl shadow-lg"
  >
    <p className="text-yellow-400 font-semibold mb-2">
      AI Coach Feedback
    </p>

    {feedback.length ? (
      feedback.map((f, i) => (
        <p key={i} className="text-sm text-white/80">
          • {f}
        </p>
      ))
    ) : (
      <p className="text-white/40 text-sm">
        Analizando técnica...
      </p>
    )}
  </div>
</div>
/* ===================== COMPONENT ===================== */
function Card({ title, value }) {
  return (
    <div style={{ background: "#132B45" }} className="p-4 rounded-xl">
      <p className="text-white/60">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
