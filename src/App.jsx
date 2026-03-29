import React, { useEffect, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

/* ========================= UTILS ========================= */

const DEFAULT_USER = { name: "Athlete", sessions: [] };

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("rowxia_user");
    return raw ? JSON.parse(raw) : DEFAULT_USER;
  } catch {
    return DEFAULT_USER;
  }
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const lerp = (a, b, t) => a + (b - a) * t;

const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

/* ========================= TECHNIQUE ========================= */

function getTechnique() {
  return {
    rowerg: { catch: 75, driveRatio: 0.42 },
    rp3: { catch: 70, driveRatio: 0.44 },
  };
}

/* ========================= APP ========================= */

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [user, setUser] = useState(loadStoredUser());
  const [analysis, setAnalysis] = useState("Esperando video...");
  const [score, setScore] = useState(0);
  const [spm, setSpm] = useState(0);
  const [phase, setPhase] = useState("Idle");

  const strokeRef = useRef([]);
  const lastFrameRef = useRef(null);

  /* ========================= VIDEO UPLOAD ========================= */

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoSrc(URL.createObjectURL(file));
    strokeRef.current = [];
    lastFrameRef.current = null;
  };

  /* ========================= ANGLES ========================= */

  function getAngle(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };

    const dot = AB.x * CB.x + AB.y * CB.y;
    const mag = Math.sqrt(AB.x ** 2 + AB.y ** 2) * Math.sqrt(CB.x ** 2 + CB.y ** 2);

    const cos = clamp(dot / (mag || 1e-6), -1, 1);
    return (Math.acos(cos) * 180) / Math.PI;
  }

  /* ========================= VIDEO PIPELINE ========================= */

  useEffect(() => {
    if (!videoSrc) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
    });

    pose.onResults((res) => {
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
      const trunkAngle = getAngle(shoulder, hip, knee);
      const elbowAngle = getAngle(shoulder, elbow, wrist);

      const prev = lastFrameRef.current;

      const frame = {
        kneeAngle,
        trunkAngle,
        elbowAngle,
      };

      strokeRef.current.push(frame);
      lastFrameRef.current = frame;

      /* ========================= PHASE DETECTION ========================= */

      let currentPhase = "Recovery";

      if (kneeAngle < 80) currentPhase = "Catch";
      else if (prev && kneeAngle > prev.kneeAngle) currentPhase = "Drive";
      else if (prev && elbowAngle < prev.elbowAngle) currentPhase = "Finish";

      setPhase(currentPhase);

      /* ========================= DRAW STICKMAN ========================= */

      const drawLine = (a, b) => {
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 3;
        ctx.stroke();
      };

      drawLine(shoulder, elbow);
      drawLine(elbow, wrist);
      drawLine(shoulder, hip);
      drawLine(hip, knee);
      drawLine(knee, ankle);

      /* ========================= SIMPLE ANALYSIS ========================= */

      const tech = getTechnique().rowerg;

      const scoreCalc = clamp(
        100 -
          Math.abs(kneeAngle - 120) * 0.3 -
          Math.abs(trunkAngle - 30) * 0.3 -
          Math.abs(elbowAngle - 150) * 0.2,
        0,
        100
      );

      setScore(Math.round(scoreCalc));

      setAnalysis(
        kneeAngle < tech.catch
          ? "Buen catch"
          : "Revisa profundidad en catch"
      );
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      camera.start();
    };
  }, [videoSrc]);

  /* ========================= UI ========================= */

  return (
    <div className="min-h-screen bg-[#0B1A2B] text-white p-6">
      <h1 className="text-2xl text-yellow-400 font-bold mb-4">RowXia</h1>

      {!videoSrc ? (
        <input type="file" accept="video/*" onChange={handleUpload} />
      ) : (
        <>
          <canvas ref={canvasRef} className="w-full rounded-xl" />
          <video ref={videoRef} src={videoSrc} className="hidden" />

          <div className="mt-4 bg-[#132B45] p-4 rounded-xl">
            <p>Phase: {phase}</p>
            <p>Score: {score}</p>
            <p>{analysis}</p>
          </div>
        </>
      )}
    </div>
  );
}
