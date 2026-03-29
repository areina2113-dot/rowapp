// RowXia v4 ELITE - App.jsx
// Arquitectura avanzada manteniendo espíritu original + mejoras PRO

import React, { useEffect, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [points, setPoints] = useState([]);

  // =========================
  // INITIALIZE MEDIAPIPE
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
          await pose.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
    }
  }, []);

  // =========================
  // POSE RESULTS HANDLER
  // =========================
  function onResults(results) {
    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;

    // Example: track shoulders midpoint
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const midX = (leftShoulder.x + rightShoulder.x) / 2;
    const midY = (leftShoulder.y + rightShoulder.y) / 2;

    const canvas = canvasRef.current;
    const x = midX * canvas.width;
    const y = midY * canvas.height;

    setPoints((prev) => [...prev.slice(-200), { x, y }]);

    // Simple stroke heuristic (v4 placeholder engine)
    analyzeStroke(landmarks);
  }

  // =========================
  // STROKE ENGINE (SIMPLIFIED ELITE CORE)
  // =========================
  function analyzeStroke(landmarks) {
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];

    const elbowHeight = (leftElbow.y + rightElbow.y) / 2;

    let msg = "Stable";

    if (elbowHeight < 0.4) msg = "Catch phase detected";
    if (elbowHeight > 0.7) msg = "Finish phase detected";

    setFeedback((prev) => [msg, ...prev.slice(0, 4)]);
  }

  // =========================
  // DRAW CANVAS
  // =========================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (points.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = 3;

        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });

        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }

    draw();
  }, [points]);

  // =========================
  // START CAMERA
  // =========================
  const startCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.start();
      setIsRunning(true);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>RowXia v4 ELITE</h1>

      <div>
        <video
          ref={videoRef}
          style={{ width: "320px", borderRadius: 12 }}
          autoPlay
          playsInline
        />

        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ border: "1px solid #ccc", marginTop: 10 }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={startCamera}>
          {isRunning ? "Running" : "Start Camera"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Feedback</h3>
        <ul>
          {feedback.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
