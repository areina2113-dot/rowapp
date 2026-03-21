import React, { useRef, useState, useEffect } from "react";
// ===== 🧬 OLIMPIC + NATIONAL AI =====

function buildOlympicModel() {
  return {
    fatigue: 0,
    consistencyHistory: [],
    powerTrend: [],
    rhythmHistory: [],
  };
}

function normalizeStroke(stroke) {
  const len = stroke.length;
  return stroke.map((frame, i) => ({
    ...frame,
    phase: i / (len - 1),
  }));
}

const eliteProfiles = {
  concept2: {
    driveRatio: 0.42,
    peakLegs: 15,
    peakBack: 10,
    peakArms: 8,
  },
  spanish: {
    driveRatio: 0.45,
    peakLegs: 16,
    peakBack: 11,
    peakArms: 9,
  },
};

function classifyRowerStyle(stroke) {
  let legs = 0, back = 0, arms = 0;

  stroke.forEach(f => {
    legs += Math.abs(f.kneeAngle);
    back += Math.abs(f.trunkAngle);
    arms += Math.abs(f.elbowAngle);
  });

  if (legs > back && legs > arms) return "Piernas dominante";
  if (back > legs && back > arms) return "Espalda dominante";
  return "Brazos dominante";
}

function compareToElite(stroke, profile) {
  const normalized = normalizeStroke(stroke);
  let error = 0;

  normalized.forEach(f => {
    error += Math.abs(f.kneeAngle - profile.peakLegs);
    error += Math.abs(f.trunkAngle - profile.peakBack);
    error += Math.abs(f.elbowAngle - profile.peakArms);
  });

  return Math.round(error / normalized.length);
}

function advancedTechnicalErrors(stroke) {
  let errors = [];

  if (stroke.find(f => f.elbowAngle < 140 && f.kneeAngle < 130))
    errors.push("Brazos demasiado tempranos");

  if (stroke.every(f => f.kneeAngle < 150))
    errors.push("Drive débil");

  if (stroke.some(f => f.trunkAngle > 25))
    errors.push("Exceso inclinación");

  return errors;
}

function estimateAdvancedPower(stroke) {
  let power = 0;

  for (let i = 1; i < stroke.length; i++) {
    power +=
      Math.abs(stroke[i].kneeAngle - stroke[i - 1].kneeAngle) * 0.5 +
      Math.abs(stroke[i].trunkAngle - stroke[i - 1].trunkAngle) * 0.3 +
      Math.abs(stroke[i].elbowAngle - stroke[i - 1].elbowAngle) * 0.2;
  }

  return Math.round(power);
}

function calculateDriveRecoveryRatio(stroke) {
  const mid = Math.floor(stroke.length * 0.4);
  return (mid / (stroke.length - mid)).toFixed(2);
}

function detectFatigue(history) {
  if (history.length < 5) return 0;

  const last = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const prev = history.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

  return prev - last;
}

function predictPerformance(score, power, spm) {
  return Math.round(score * 0.5 + power * 0.3 + spm * 0.2);
}
export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  // ===== 👤 USER SYSTEM =====
const [user, setUser] = useState({
  name: "Athlete",
  sessions: [],
});

// ===== ⏱️ SPM =====
const [spm, setSpm] = useState(0);
const strokeTimesRef = useRef([]);

// ===== 🧬 AI =====
const olympicAIRef = useRef(buildOlympicModel());
const athleteProfileRef = useRef(null);
  const [phase, setPhase] = useState("Esperando...");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState("erg");

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const bestStrokeRef = useRef(null);
  const chartRef = useRef([]);

  // 🔥 MODELOS POR TIPO DE REMO (CLAVE)
  const models = {
    erg: { catch: 75, sequence: ["legs", "back", "arms"] },
    rp3: { catch: 70, sequence: ["legs", "back", "arms"] },
    banco_movil: { catch: 80, sequence: ["legs", "back", "arms"] },
    banco_fijo: { catch: 85, sequence: ["back", "arms"] },
    coastal: { catch: 78, sequence: ["legs", "back", "arms"] },
  };

  // 🔥 CURVA IDEAL (élite simulada)
  const idealCurve = Array.from({ length: 80 }, (_, i) => ({
    legs: Math.sin((i / 80) * Math.PI) * 15,
    back: Math.sin((i / 80) * Math.PI - 0.5) * 10,
    arms: Math.sin((i / 80) * Math.PI - 1) * 8,
  }));

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoSrc(URL.createObjectURL(file));
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

  const stepFrame = () => {
    const v = videoRef.current;
    v.pause();
    setIsPlaying(false);
    v.currentTime += 0.03;
  };

  function getAngle(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };
    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
    const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);
    return (Math.acos(dot / (magAB * magCB)) * 180) / Math.PI;
  }

  function angleToVertical(A, B) {
    return (Math.atan2(B.x - A.x, B.y - A.y) * 180) / Math.PI;
  }

  useEffect(() => {
    if (!videoSrc || !window.Pose) return;
// guardar
useEffect(() => {
  localStorage.setItem("rowxia_user", JSON.stringify(user));
}, [user]);

// cargar
useEffect(() => {
  const saved = localStorage.getItem("rowxia_user");
  if (saved) setUser(JSON.parse(saved));
}, []);
    const pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
    });

    pose.onResults((res) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

      if (!res.poseLandmarks) return;

      const lm = res.poseLandmarks;

      // 🔥 STICKMAN
      const draw = (a, b, color = "#FFD700", w = 3) => {
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
      };

      draw(lm[12], lm[14]);
      draw(lm[14], lm[16]);
      draw(lm[12], lm[24]);
      draw(lm[24], lm[26]);
      draw(lm[26], lm[28]);

      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];
      const hip = lm[24];
      const knee = lm[26];
      const ankle = lm[28];

      const kneeAngle = getAngle(hip, knee, ankle);
      const trunkAngle = angleToVertical(hip, shoulder);
      const elbowAngle = getAngle(shoulder, elbow, wrist);

      const history = historyRef.current;
      history.push({ kneeAngle, trunkAngle, elbowAngle });
      if (history.length > 30) history.shift();

      // 🔥 VELOCIDAD (clave timing)
      if (history.length > 2) {
        const prev = history[history.length - 2];
        const curr = history[history.length - 1];

        const vel = {
          legs: curr.kneeAngle - prev.kneeAngle,
          back: curr.trunkAngle - prev.trunkAngle,
          arms: curr.elbowAngle - prev.elbowAngle,
        };

        chartRef.current.push(vel);
        if (chartRef.current.length > 80) chartRef.current.shift();
      }

      // 🔥 DETECTAR PALADA
      if (kneeAngle < models[mode].catch && strokeRef.current.length > 10) {
        analyzeStroke(strokeRef.current);
        strokeRef.current = [];
      }
const now = Date.now();
strokeTimesRef.current.push(now);

if (strokeTimesRef.current.length > 10) {
  strokeTimesRef.current.shift();
}

if (strokeTimesRef.current.length > 2) {
  const diff =
    strokeTimesRef.current[strokeTimesRef.current.length - 1] -
    strokeTimesRef.current[0];

  setSpm(Math.round((strokeTimesRef.current.length / diff) * 60000));
}
      strokeRef.current.push({ kneeAngle, trunkAngle, elbowAngle });

      // 🔥 GHOST STROKE (mejor palada)
      if (bestStrokeRef.current) {
        bestStrokeRef.current.forEach((p, i) => {
          if (i % 5 === 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(0,255,255,0.4)";
            ctx.fill();
          }
        });
      }
    });

    const video = videoRef.current;

    video.onloadeddata = () => {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const loop = async () => {
        if (video.paused || video.ended) return;
        await pose.send({ image: video });
        requestAnimationFrame(loop);
      };

      video.play();
      setIsPlaying(true);
      loop();
    };
  }, [videoSrc, mode]);

  // 🔥 SCORING REAL DE TIMING
  function analyzeStroke(stroke) {const power = estimateAdvancedPower(stroke);
const ratio = calculateDriveRecoveryRatio(stroke);
const style = classifyRowerStyle(stroke);
const eliteError = compareToElite(stroke, eliteProfiles.spanish);
const advancedErrors = advancedTechnicalErrors(stroke);

// fatiga
olympicAIRef.current.powerTrend.push(power);
if (olympicAIRef.current.powerTrend.length > 20)
  olympicAIRef.current.powerTrend.shift();

const fatigue = detectFatigue(olympicAIRef.current.powerTrend);

// score final
const finalScore = Math.round(
  score * 0.4 + power * 0.2 + (100 - eliteError) * 0.4
);

// predicción
const prediction = predictPerformance(finalScore, power, spm);

// guardar sesión
setUser(prev => ({
  ...prev,
  sessions: [
    ...prev.sessions,
    {
      date: new Date().toISOString(),
      score: finalScore,
      power,
      spm,
      fatigue,
    },
  ],
}));

// feedback
setFeedback([
  ...advancedErrors,
  `Estilo: ${style}`,
  `Error vs élite: ${eliteError}`,
  `Potencia: ${power}`,
  `SPM: ${spm}`,
  `Ratio: ${ratio}`,
  `Fatiga: ${Math.round(fatigue)}`,
  `Predicción: ${prediction}`,
]);
    let timingScore = 100;
    let errors = [];

    let legsStart = stroke.findIndex((f) => f.kneeAngle > 130);
    let backStart = stroke.findIndex((f) => f.trunkAngle > 10);
    let armsStart = stroke.findIndex((f) => f.elbowAngle < 150);

    if (!(legsStart < backStart && backStart < armsStart)) {
      errors.push("Timing incorrecto (secuencia rota)");
      timingScore -= 40;
    }

    if (backStart - legsStart < 2) {
      errors.push("Espalda abre demasiado pronto");
      timingScore -= 20;
    }

    if (armsStart - backStart < 2) {
      errors.push("Brazos entran demasiado pronto");
      timingScore -= 20;
    }

    if (timingScore > score) {
      bestStrokeRef.current = stroke;
    }

    setScore(timingScore);
    setFeedback(errors.length ? errors : ["Timing perfecto"]);
  }

  // 🔥 GRAFICA PRO CON CURVA IDEAL + ERRORES
  const renderGraph = () => {
    const data = chartRef.current;
    const width = 500;
    const height = 180;

    const scaleX = width / (data.length || 1);
    const scaleY = 3;

    const buildPath = (arr, key) =>
      arr
        .map((d, i) => {
          const x = i * scaleX;
          const y = height / 2 - d[key] * scaleY;
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    return (
      <svg width={width} height={height} className="bg-[#0E2238] rounded">
        {/* IDEAL */}
        <path d={buildPath(idealCurve, "legs")} stroke="#00FF88" opacity={0.2} fill="none" />
        <path d={buildPath(idealCurve, "back")} stroke="#3399FF" opacity={0.2} fill="none" />
        <path d={buildPath(idealCurve, "arms")} stroke="#FF00AA" opacity={0.2} fill="none" />

        {/* REAL */}
        <path d={buildPath(data, "legs")} stroke="#00FF88" fill="none" />
        <path d={buildPath(data, "back")} stroke="#3399FF" fill="none" />
        <path d={buildPath(data, "arms")} stroke="#FF00AA" fill="none" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#0B1A2B] text-white">

      {/* SIDEBAR */}
      <div className="w-64 bg-black p-6">
        <h1 className="text-yellow-400 font-bold text-xl">ROWXIA</h1>

        <select
          className="mt-4 p-2 text-black"
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="erg">Erg</option>
          <option value="rp3">RP3</option>
          <option value="banco_movil">Banco móvil</option>
          <option value="banco_fijo">Banco fijo</option>
          <option value="coastal">Coastal</option>
        </select>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col items-center justify-center">

        {!videoSrc ? (
          <input type="file" accept="video/*" onChange={handleUpload} />
        ) : (
          <>
            <canvas ref={canvasRef} className="rounded mb-4" />
            <video ref={videoRef} src={videoSrc} className="hidden" />

            <div className="flex gap-4">
              <button onClick={togglePlay} className="bg-yellow-400 text-black px-4 py-2 rounded">
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button onClick={stepFrame} className="bg-white text-black px-4 py-2 rounded">
                Step
              </button>
            </div>
            <button
  onClick={() => {
    const blob = new Blob([JSON.stringify(user)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rowxia_data.json";
    a.click();
  }}
  className="bg-green-400 text-black px-4 py-2 rounded"
>
  Exportar datos
</button>

            <div className="mt-4 bg-[#132B45] p-4 rounded w-[500px]">
              <p>Score timing: {score}%</p>

              {feedback.map((f, i) => (
                <p key={i} className="text-yellow-400">{f}</p>
              ))}

              <div className="mt-4">
                {renderGraph()}
              </div>
              <div className="mt-6 bg-[#132B45] p-4 rounded w-[500px]">
  <p className="text-yellow-400">Progreso</p>

  <p>Total sesiones: {user.sessions.length}</p>

  <p>
    Score medio:{" "}
    {user.sessions.length
      ? Math.round(
          user.sessions.reduce((a, b) => a + b.score, 0) /
            user.sessions.length
        )
      : 0}
  </p>
</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
