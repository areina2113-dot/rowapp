import React, { useEffect, useRef, useState, useMemo } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";

/* ========================= =========================
   ROWXIA PRO ARCHITECTURE v2
   - Modular inside single file (deploy-friendly)
   - Video pipeline + pose detection
   - Stroke analysis engine separated logically
   - Scoring + phase detection
   ========================= ========================= */

/* ========================= UTILITIES ========================= */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const getAngle = (A, B, C) => {
  const AB = { x: A.x - B.x, y: A.y - B.y };
  const CB = { x: C.x - B.x, y: C.y - B.y };

  const dot = AB.x * CB.x + AB.y * CB.y;
  const mag = Math.sqrt(AB.x ** 2 + AB.y ** 2) * Math.sqrt(CB.x ** 2 + CB.y ** 2);

  const cos = clamp(dot / (mag || 1e-6), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
};

/* ========================= ANALYSIS ENGINE ========================= */

const StrokeEngine = {
  analyze({ lm, prev }) {
    const shoulder = lm[12];
    const elbow = lm[14];
    const wrist = lm[16];
    const hip = lm[24];
    const knee = lm[26];
    const ankle = lm[28];

    const kneeAngle = getAngle(hip, knee, ankle);
    const trunkAngle = getAngle(shoulder, hip, knee);
    const elbowAngle = getAngle(shoulder, elbow, wrist);

    let phase = "Recovery";

    if (kneeAngle < 80) phase = "Catch";
    else if (prev && kneeAngle > prev.kneeAngle) phase = "Drive";
    else if (prev && elbowAngle < prev.elbowAngle) phase = "Finish";

    const score = clamp(
      100 -
        Math.abs(kneeAngle - 120) * 0.3 -
        Math.abs(trunkAngle - 30) * 0.3 -
        Math.abs(elbowAngle - 150) * 0.2,
      0,
      100
    );

    const feedback = this.getFeedback({ kneeAngle, trunkAngle, elbowAngle });

    return {
      kneeAngle,
      trunkAngle,
      elbowAngle,
      phase,
      score: Math.round(score),
      feedback,
    };
  },

  getFeedback({ kneeAngle, trunkAngle }) {
    if (kneeAngle < 80) return "Catch too deep";
    if (trunkAngle > 50) return "Excessive lean";
    return "Good form";
  },
};

/* ========================= UI COMPONENTS ========================= */

function UploadControl({ onUpload }) {
  return (
    <input
      type="file"
      accept="video/*"
      onChange={(e) => onUpload(e.target.files?.[0])}
      className="text-white"
    />
  );
}

function StatsPanel({ phase, score, feedback }) {
  return (
    <div className="mt-4 bg-[#132B45] p-4 rounded-xl space-y-2">
      <p>Phase: {phase}</p>
      <p>Score: {score}</p>
      <p>{feedback}</p>
    </div>
  );
}

function VideoCanvas({ videoRef, canvasRef }) {
  return (
    <>
      <canvas ref={canvasRef} className="w-full rounded-xl" />
      <video ref={videoRef} className="hidden" />
    </>
  );
}

/* ========================= MAIN APP ========================= */

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [phase, setPhase] = useState("Idle");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("Waiting for video...");

  const prevFrame = useRef(null);

  /* ========================= VIDEO UPLOAD ========================= */

  const handleUpload = (file) => {
    if (!file) return;
    setVideoSrc(URL.createObjectURL(file));
    prevFrame.current = null;
  };

  /* ========================= PIPELINE ========================= */

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

      if (res.image) {
        ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);
      }

      if (!res.poseLandmarks) return;

      const result = StrokeEngine.analyze({
        lm: res.poseLandmarks,
        prev: prevFrame.current,
      });

      prevFrame.current = result;

      setPhase(result.phase);
      setScore(result.score);
      setFeedback(result.feedback);
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await pose.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    video.src = videoSrc;

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      camera.start();
    };
  }, [videoSrc]);

  /* ========================= RENDER ========================= */

  return (
    <div className="min-h-screen bg-[#0B1A2B] text-white p-6">
      <h1 className="text-2xl text-yellow-400 font-bold mb-4">RowXia PRO</h1>

      {!videoSrc ? (
        <UploadControl onUpload={handleUpload} />
      ) : (
        <>
          <VideoCanvas videoRef={videoRef} canvasRef={canvasRef} />
          <StatsPanel phase={phase} score={score} feedback={feedback} />
        </>
      )}
    </div>
  );
}
