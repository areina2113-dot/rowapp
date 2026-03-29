import React, { useEffect, useRef, useState } from "react";
import { Pose } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

export default function App() {
  // ================= STATE =================
  const [showIntro, setShowIntro] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [analysis, setAnalysis] = useState("Esperando video...");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);

  // ================= LOAD SESSIONS =================
  useEffect(() => {
    const saved = localStorage.getItem("rowxia_sessions");
    if (saved) setSessions(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("rowxia_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // ================= MEDIA PIPE INIT =================
  useEffect(() => {
    if (!videoFile) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const ctx = canvasElement.getContext("2d");

    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    poseRef.current = pose;

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await pose.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });

    camera.start();

    function onResults(results) {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      ctx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, Pose.POSE_CONNECTIONS, {
          color: "#FFD700",
          lineWidth: 2,
        });

        drawLandmarks(ctx, results.poseLandmarks, {
          color: "#00FFCC",
          lineWidth: 1,
        });

        analyzeStroke(results.poseLandmarks);
      }
    }

    function analyzeStroke(landmarks) {
      // Ejemplo simple biomecánico (puedes mejorarlo)
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftWrist = landmarks[15];

      const shoulderSlope =
        Math.abs(leftShoulder.y - rightShoulder.y) * 100;

      if (shoulderSlope > 5) {
        setAnalysis("⚠️ Inclinación excesiva de hombros");
      } else if (leftWrist.y < leftShoulder.y) {
        setAnalysis("✅ Buena fase de tracción detectada");
      } else {
        setAnalysis("🔄 Movimiento en fase de recuperación");
      }
    }

    return () => {
      camera.stop();
    };
  }, [videoFile]);

  // ================= SAVE SESSION =================
  function saveSession() {
    const session = {
      date: new Date().toISOString(),
      note: analysis,
    };

    setSessions((prev) => [...prev, session]);
  }

  // ================= INTRO =================
  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1A2B] text-white">
        <img src="/logo.png" className="w-32 mb-6" />
        <h1 className="text-4xl font-bold text-yellow-400">ROWXIA</h1>
        <p className="text-white/60 mt-2">Understand your stroke</p>

        <button
          onClick={() => setShowIntro(false)}
          className="mt-6 bg-yellow-400 text-black px-6 py-2 rounded-xl"
        >
          Empezar
        </button>
      </div>
    );
  }

  // ================= MAIN =================
  return (
    <div className="min-h-screen bg-[#0B1A2B] text-white p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl text-yellow-400 font-bold">RowXia</h1>
      </div>

      {/* VIDEO INPUT */}
      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files[0];
          setVideoFile(URL.createObjectURL(file));
        }}
        className="mb-4"
      />

      {/* VIDEO + CANVAS */}
      <div className="relative">
        <video
          ref={videoRef}
          src={videoFile}
          className="hidden"
          controls
        />

        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full rounded-2xl bg-black"
        />
      </div>

      {/* ANALYSIS */}
      <div className="mt-4 bg-[#132B45] p-4 rounded-xl">
        <h2 className="text-yellow-400 font-semibold mb-2">
          IA Analysis
        </h2>
        <p>{analysis}</p>
      </div>

      {/* SAVE */}
      <button
        onClick={saveSession}
        className="mt-4 bg-green-500 px-4 py-2 rounded-xl"
      >
        Save Analysis
      </button>

      {/* HISTORY */}
      <div className="mt-6">
        <h2 className="mb-2 font-semibold">Sessions</h2>
        {sessions.map((s, i) => (
          <div key={i} className="bg-[#132B45] p-3 rounded-xl mb-2">
            <p>{s.note}</p>
            <p className="text-xs text-white/50">{s.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
