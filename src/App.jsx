import React, { useRef, useEffect, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const [phase, setPhase] = useState("Idle");
  const [feedback, setFeedback] = useState([]);

  const [angles, setAngles] = useState({
    knee: 0,
    hip: 0,
    elbow: 0,
  });

  // 🆕 V8 STATES
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState([]);
  const [consistency, setConsistency] = useState(100);
  const prevAnglesRef = useRef(null);

  // =========================
  // UTILS
  // =========================
  const getAngle = (A, B, C) => {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };
    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.hypot(AB.x, AB.y);
    const magCB = Math.hypot(CB.x, CB.y);
    const cos = dot / (magAB * magCB + 0.0001);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  };

  const angleToVertical = (A, B) => {
    return (Math.atan2(B.x - A.x, B.y - A.y) * 180) / Math.PI;
  };

  // =========================
  // MEDIAPIPE
  // =========================
  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    if (videoRef.current) {
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await pose.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
    }
  }, []);

  // =========================
  // CORE ANALYSIS
  // =========================
  function onResults(res) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

    if (!res.poseLandmarks) return;

    const lm = res.poseLandmarks;

    const shoulder = lm[12];
    const elbow = lm[14];
    const wrist = lm[16];
    const hip = lm[24];
    const knee = lm[26];
    const ankle = lm[28];

    const kneeAngle = getAngle(hip, knee, ankle);
    const elbowAngle = getAngle(shoulder, elbow, wrist);
    const hipAngle = angleToVertical(hip, shoulder);

    setAngles({
      knee: Math.round(kneeAngle),
      elbow: Math.round(elbowAngle),
      hip: Math.round(hipAngle),
    });

    // =========================
    // FASE
    // =========================
    let currentPhase = "Recovery";

    if (kneeAngle < 80) currentPhase = "Catch";
    else if (kneeAngle > 100 && elbowAngle > 150) currentPhase = "Drive";
    else if (elbowAngle < 120) currentPhase = "Finish";

    setPhase(currentPhase);

    // =========================
    // AI COACH
    // =========================
    const tips = [];

    if (elbowAngle < 140 && kneeAngle < 120)
      tips.push("❌ Brazos demasiado pronto");

    if (kneeAngle < 60)
      tips.push("⚠️ Over-compression");

    if (hipAngle > 30)
      tips.push("⚠️ Layback excesivo");

    if (tips.length === 0) tips.push("✅ Técnica estable");

    setFeedback(tips);

    // =========================
    // SCORE
    // =========================
    let currentScore = 100;

    if (elbowAngle < 140 && kneeAngle < 120) currentScore -= 20;
    if (kneeAngle < 60) currentScore -= 15;
    if (hipAngle > 30) currentScore -= 10;

    currentScore = Math.max(0, currentScore);
    setScore(currentScore);

    // =========================
    // CONSISTENCY
    // =========================
    if (prevAnglesRef.current) {
      const diff =
        Math.abs(prevAnglesRef.current.knee - kneeAngle) +
        Math.abs(prevAnglesRef.current.elbow - elbowAngle);

      setConsistency(Math.max(0, 100 - diff));
    }

    prevAnglesRef.current = {
      knee: kneeAngle,
      elbow: elbowAngle,
    };

    // =========================
    // HISTORY
    // =========================
    setHistory((prev) => [
      ...prev.slice(-50),
      { score: currentScore },
    ]);

    // =========================
    // STICKMAN
    // =========================
    const draw = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.stroke();
    };

    draw(shoulder, elbow);
    draw(elbow, wrist);
    draw(shoulder, hip);
    draw(hip, knee);
    draw(knee, ankle);
  }

  // =========================
  // VIDEO
  // =========================
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoSrc(URL.createObjectURL(file));
  };

  const start = () => {
    if (cameraRef.current) {
      cameraRef.current.start();
      setIsRunning(true);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={{ background: "#0B1A2B", minHeight: "100vh", color: "white" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", padding: 20, gap: 15 }}>
        <img src="/logo.png" alt="RowXia" style={{ height: 60 }} />
        <h1 style={{ color: "#FFD700" }}>RowXia v8</h1>
      </div>

      <div style={{ padding: 20 }}>

        <input type="file" accept="video/*" onChange={handleUpload} />

        {videoSrc && (
          <>
            <video ref={videoRef} src={videoSrc} autoPlay playsInline style={{ display: "none" }} />
            <canvas ref={canvasRef} width={640} height={480} />
          </>
        )}

        <button onClick={start} style={{ marginTop: 10 }}>
          {isRunning ? "Running..." : "Start Analysis"}
        </button>

        {/* MÉTRICAS */}
        <div style={{ marginTop: 20 }}>
          <h3>Fase: {phase}</h3>
          <p>Rodilla: {angles.knee}°</p>
          <p>Codo: {angles.elbow}°</p>
          <p>Cadera: {angles.hip}°</p>

          <p>Score: {score}</p>
          <p>Consistency: {Math.round(consistency)}%</p>
        </div>

        {/* FEEDBACK */}
        <div style={{ marginTop: 20 }}>
          <h3>AI Coach</h3>
          {feedback.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>

        {/* PROGRESO */}
        <div style={{ marginTop: 20 }}>
          <h3>Progreso</h3>
          <svg width="300" height="100">
            {history.map((h, i) => {
              const x = (i / 50) * 300;
              const y = 100 - h.score;
              return <circle key={i} cx={x} cy={y} r="2" fill="#FFD700" />;
            })}
          </svg>
        </div>

      </div>
    </div>
  );
}
