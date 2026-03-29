// RowXia v6 PRO HYBRID - UI original + Video Upload + Pose AI real

import React, { useRef, useState, useEffect } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [points, setPoints] = useState([]);

  // =========================
  // MEDIAPIPE INIT
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
  // HANDLE POSE RESULTS
  // =========================
  function onResults(results) {
    if (!results.poseLandmarks) return;

    const landmarks = results.poseLandmarks;

    // shoulders midpoint
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const midX = (leftShoulder.x + rightShoulder.x) / 2;
    const midY = (leftShoulder.y + rightShoulder.y) / 2;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = midX * canvas.width;
    const y = midY * canvas.height;

    setPoints((prev) => [...prev.slice(-200), { x, y }]);

    analyzeStroke(landmarks);
  }

  // =========================
  // STROKE ANALYSIS
  // =========================
  function analyzeStroke(landmarks) {
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];

    const elbowAvgY = (leftElbow.y + rightElbow.y) / 2;

    let msg = "Stable";

    if (elbowAvgY < 0.4) msg = "Catch phase";
    else if (elbowAvgY > 0.7) msg = "Finish phase";
    else msg = "Drive phase";

    setFeedback((prev) => [msg, ...prev.slice(0, 5)]);
  }

  // =========================
  // DRAW CANVAS TRAJECTORY
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
  // VIDEO UPLOAD
  // =========================
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoFile(url);
  };

  // =========================
  // START CAMERA (if webcam)
  // =========================
  const startCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.start();
      setIsRunning(true);
    }
  };

  // =========================
  // UI (similar to original but enhanced)
  // =========================
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>RowXia v6 PRO HYBRID</h1>

      <div style={{ marginBottom: 10 }}>
        <input type="file" accept="video/*" onChange={handleUpload} />
      </div>

      {videoFile && (
        <div>
          <video
            ref={videoRef}
            src={videoFile}
            width="320"
            controls
            autoPlay
            playsInline
            style={{ borderRadius: 12 }}
          />
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button onClick={startCamera}>
          {isRunning ? "Running" : "Start Camera"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>AI Coach Feedback</h3>
        <ul>
          {feedback.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
