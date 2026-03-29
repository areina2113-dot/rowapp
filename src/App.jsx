// App.jsx - RowXia (Optimized & Ready)
import React, { useEffect, useRef, useState } from "react";

export default function App() {
  // ================= STATE =================
  const [showIntro, setShowIntro] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [points, setPoints] = useState([]);
  const [score, setScore] = useState(0);
  const [spm, setSpm] = useState(0);
  const [powerValue, setPowerValue] = useState(0);
  const [fatigueValue, setFatigueValue] = useState(0);
  const [sessions, setSessions] = useState([]);

  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // ================= LOAD SAVED DATA =================
  useEffect(() => {
    const saved = localStorage.getItem("rowxia_sessions");
    if (saved) {
      setSessions(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("rowxia_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // ================= DRAW =================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;

      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });

      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [points]);

  // ================= SIMULATED TRACKING =================
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setPoints((prev) => [
        ...prev,
        {
          x: Math.random() * 400,
          y: Math.random() * 300,
        },
      ]);

      setSpm((prev) => prev + 1);
      setPowerValue((prev) => prev + Math.random() * 2);
      setFatigueValue((prev) => prev + 0.1);
      setScore((prev) => prev + Math.random() * 5);
    }, 500);

    return () => clearInterval(interval);
  }, [isRecording]);

  // ================= WORKOUT AI =================
  function generateWorkout(score, fatigue, spm) {
    if (fatigue > 10) {
      return "🟡 Sesión de recuperación + técnica ligera (UT2)";
    }

    if (score < 60) {
      return "🔧 Drills técnicos + pausas largas (catch / sequencing)";
    }

    if (score < 80) {
      return "⚡ Intervalos moderados (4x6 min @ r20-24)";
    }

    return "🔥 Alta intensidad (HIIT / race pace intervals)";
  }

  const workoutPlan = generateWorkout(score, fatigueValue, spm);

  // ================= FINALIZE SESSION =================
  function finalizeSession() {
    const session = {
      score,
      spm,
      power: powerValue,
      fatigue: fatigueValue,
      date: new Date().toISOString(),
    };

    setSessions((prev) => [...prev, session]);

    setPoints([]);
    setScore(0);
    setSpm(0);
    setPowerValue(0);
    setFatigueValue(0);
  }

  // ================= UI COMPONENT =================
  function MetricCard({ title, value, subtitle }) {
    return (
      <div className="bg-[#132B45] rounded-2xl p-4 shadow-lg hover:scale-[1.02] transition">
        <p className="text-white/60 text-sm">{title}</p>
        <p className="text-2xl font-bold text-yellow-400">{value}</p>
        {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
      </div>
    );
  }

  // ================= INTRO SCREEN =================
  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1A2B] text-white">
        <img src="/logo.png" alt="RowXia" className="w-32 mb-6" />

        <h1 className="text-4xl font-bold text-yellow-400">ROWXIA</h1>
        <p className="text-white/60 mt-2">Understand your stroke</p>

        <button
          onClick={() => setShowIntro(false)}
          className="mt-6 bg-yellow-400 text-black px-6 py-2 rounded-xl font-semibold hover:scale-105 transition"
        >
          Empezar
        </button>
      </div>
    );
  }

  // ================= MAIN APP =================
  return (
    <div className="min-h-screen bg-[#0B1A2B] text-white p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" className="w-8" />
          <h1 className="text-xl font-bold text-yellow-400">RowXia</h1>
        </div>

        <button
          onClick={() => setIsRecording(!isRecording)}
          className="bg-yellow-400 text-black px-4 py-2 rounded-xl"
        >
          {isRecording ? "Pause" : "Start"}
        </button>
      </div>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        className="bg-black rounded-2xl mb-4 w-full"
      />

      {/* METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Score" value={Math.round(score)} />
        <MetricCard title="SPM" value={spm} />
        <MetricCard title="Power" value={Math.round(powerValue)} />
        <MetricCard title="Fatigue" value={Math.round(fatigueValue)} />
      </div>

      {/* AI COACH */}
      <div className="mt-6 bg-[#132B45] p-4 rounded-2xl">
        <h3 className="text-yellow-400 font-semibold mb-2">IA Coach</h3>
        <p>{workoutPlan}</p>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={finalizeSession}
          className="bg-green-500 px-4 py-2 rounded-xl"
        >
          Save Session
        </button>

        <button
          onClick={() => setPoints([])}
          className="bg-red-500 px-4 py-2 rounded-xl"
        >
          Reset
        </button>
      </div>

      {/* HISTORY */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Sessions</h2>
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div key={i} className="bg-[#132B45] p-3 rounded-xl text-sm">
              <p>Score: {Math.round(s.score)}</p>
              <p>SPM: {s.spm}</p>
              <p>Power: {Math.round(s.power)}</p>
              <p>Fatigue: {Math.round(s.fatigue)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
