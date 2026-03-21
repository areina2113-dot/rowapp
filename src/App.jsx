import React, { useRef, useState, useEffect } from "react";

/* =========================
   🧠 MODELOS IA
========================= */

function buildAI() {
  return {
    powerTrend: [],
    consistency: [],
  };
}

function estimatePower(stroke) {
  let p = 0;
  for (let i = 1; i < stroke.length; i++) {
    p +=
      Math.abs(stroke[i].kneeAngle - stroke[i - 1].kneeAngle) * 0.5 +
      Math.abs(stroke[i].trunkAngle - stroke[i - 1].trunkAngle) * 0.3 +
      Math.abs(stroke[i].elbowAngle - stroke[i - 1].elbowAngle) * 0.2;
  }
  return Math.round(p);
}

function detectFatigue(arr) {
  if (arr.length < 6) return 0;
  const last = arr.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const prev = arr.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
  return prev - last;
}

function classifyStyle(stroke) {
  let legs = 0, back = 0, arms = 0;

  stroke.forEach(f => {
    legs += f.kneeAngle;
    back += f.trunkAngle;
    arms += f.elbowAngle;
  });

  if (legs > back && legs > arms) return "Piernas dominante";
  if (back > legs && back > arms) return "Espalda dominante";
  return "Brazos dominante";
}

/* =========================
   APP
========================= */

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [score, setScore] = useState(0);
  const [spm, setSpm] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState("erg");

  const [user, setUser] = useState({ sessions: [] });

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const bestStrokeRef = useRef(null);
  const chartRef = useRef([]);
  const strokeTimesRef = useRef([]);

  const aiRef = useRef(buildAI());

  /* =========================
     MODELOS POR DISCIPLINA
  ========================= */

  const models = {
    erg: { catch: 75 },
    rp3: { catch: 70 },
    banco_movil: { catch: 80 },
    banco_fijo: { catch: 85 },
    coastal: { catch: 78 },
  };

  /* =========================
     CURVA IDEAL (RowerUp style)
  ========================= */

  const ideal = Array.from({ length: 80 }, (_, i) => ({
    legs: Math.sin((i / 80) * Math.PI) * 15,
    back: Math.sin((i / 80) * Math.PI - 0.5) * 10,
    arms: Math.sin((i / 80) * Math.PI - 1) * 8,
  }));

  /* =========================
     VIDEO
  ========================= */

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoSrc(URL.createObjectURL(file));
  };

  const togglePlay = () => {
    const v = videoRef.current;
    v.paused ? v.play() : v.pause();
    setIsPlaying(!v.paused);
  };

  const stepFrame = () => {
    const v = videoRef.current;
    v.pause();
    setIsPlaying(false);
    v.currentTime += 0.03;
  };

  /* =========================
     STORAGE
  ========================= */

  useEffect(() => {
    localStorage.setItem("rowxia", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    const d = localStorage.getItem("rowxia");
    if (d) setUser(JSON.parse(d));
  }, []);

  /* =========================
     MEDIAPIPE LOOP
  ========================= */

  useEffect(() => {
    if (!videoSrc || !window.Pose) return;

    const pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({ modelComplexity: 1 });

    pose.onResults((res) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

      if (!res.poseLandmarks) return;

      const lm = res.poseLandmarks;

      const knee = lm[26];
      const hip = lm[24];
      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];

      const kneeAngle = Math.abs(knee.y - hip.y) * 180;
      const trunkAngle = Math.abs(shoulder.y - hip.y) * 180;
      const elbowAngle = Math.abs(wrist.y - elbow.y) * 180;

      /* HISTORIAL PARA GRAFICA */
      historyRef.current.push({ kneeAngle, trunkAngle, elbowAngle });
      if (historyRef.current.length > 30) historyRef.current.shift();

      if (historyRef.current.length > 2) {
        const prev = historyRef.current.at(-2);
        const curr = historyRef.current.at(-1);

        chartRef.current.push({
          legs: curr.kneeAngle - prev.kneeAngle,
          back: curr.trunkAngle - prev.trunkAngle,
          arms: curr.elbowAngle - prev.elbowAngle,
        });

        if (chartRef.current.length > 80) chartRef.current.shift();
      }

      /* DETECCIÓN PALADA */
      if (kneeAngle < models[mode].catch && strokeRef.current.length > 10) {
        analyzeStroke(strokeRef.current);

        const now = Date.now();
        strokeTimesRef.current.push(now);

        if (strokeTimesRef.current.length > 10)
          strokeTimesRef.current.shift();

        const diff =
          strokeTimesRef.current.at(-1) - strokeTimesRef.current[0];

        setSpm(Math.round((strokeTimesRef.current.length / diff) * 60000));

        strokeRef.current = [];
      }

      strokeRef.current.push({ kneeAngle, trunkAngle, elbowAngle });

      /* GHOST */
      if (bestStrokeRef.current) {
        bestStrokeRef.current.forEach((p, i) => {
          ctx.beginPath();
          ctx.arc(
            (i / bestStrokeRef.current.length) * canvas.width,
            canvas.height - p.kneeAngle,
            2,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = "rgba(0,255,255,0.3)";
          ctx.fill();
        });
      }
    });

    const video = videoRef.current;

    video.onloadeddata = () => {
      canvasRef.current.width = video.videoWidth;
      canvasRef.current.height = video.videoHeight;

      const loop = async () => {
        if (video.paused) return;
        await pose.send({ image: video });
        requestAnimationFrame(loop);
      };

      video.play();
      setIsPlaying(true);
      loop();
    };
  }, [videoSrc, mode]);

  /* =========================
     ANALISIS COMPLETO
  ========================= */

  function analyzeStroke(stroke) {
    let timingScore = 100;

    const legsStart = stroke.findIndex(f => f.kneeAngle > 130);
    const backStart = stroke.findIndex(f => f.trunkAngle > 10);
    const armsStart = stroke.findIndex(f => f.elbowAngle < 150);

    let errors = [];

    if (!(legsStart < backStart && backStart < armsStart)) {
      errors.push("Timing incorrecto");
      timingScore -= 40;
    }

    if (backStart - legsStart < 2) {
      errors.push("Espalda temprana");
      timingScore -= 20;
    }

    if (armsStart - backStart < 2) {
      errors.push("Brazos tempranos");
      timingScore -= 20;
    }

    const power = estimatePower(stroke);
    aiRef.current.powerTrend.push(power);

    const fatigue = detectFatigue(aiRef.current.powerTrend);
    const style = classifyStyle(stroke);

    const finalScore = Math.round(timingScore * 0.5 + power * 0.5);

    if (!bestStrokeRef.current || finalScore > score)
      bestStrokeRef.current = stroke;

    setScore(finalScore);

    setUser(prev => ({
      ...prev,
      sessions: [...prev.sessions, { score: finalScore, power, spm }]
    }));

    setFeedback([
      ...errors,
      `Potencia: ${power}`,
      `SPM: ${spm}`,
      `Fatiga: ${Math.round(fatigue)}`,
      `Estilo: ${style}`
    ]);
  }

  /* =========================
     GRAFICA ROWERUP REAL
  ========================= */

  const renderGraph = () => {
    const data = chartRef.current;

    const build = (arr, key) =>
      arr
        .map((d, i) => {
          const x = i * 6;
          const y = 90 - d[key] * 3;
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    return (
      <svg width={500} height={180} className="bg-[#0E2238] rounded">
        <path d={build(ideal, "legs")} stroke="#00FF88" opacity={0.2} fill="none"/>
        <path d={build(ideal, "back")} stroke="#3399FF" opacity={0.2} fill="none"/>
        <path d={build(ideal, "arms")} stroke="#FF00AA" opacity={0.2} fill="none"/>

        <path d={build(data, "legs")} stroke="#00FF88" fill="none"/>
        <path d={build(data, "back")} stroke="#3399FF" fill="none"/>
        <path d={build(data, "arms")} stroke="#FF00AA" fill="none"/>
      </svg>
    );
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="min-h-screen flex bg-[#0B1A2B] text-white">
      <div className="flex-1 flex flex-col items-center justify-center">

        {!videoSrc ? (
          <input type="file" onChange={handleUpload}/>
        ) : (
          <>
            <canvas ref={canvasRef}/>
            <video ref={videoRef} src={videoSrc} className="hidden"/>

            <div className="flex gap-4 mt-4">
              <button onClick={togglePlay}>Play</button>
              <button onClick={stepFrame}>Step</button>

              <button onClick={() => {
                const blob = new Blob([JSON.stringify(user)]);
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "rowxia.json";
                a.click();
              }}>
                Exportar
              </button>
            </div>

            <div className="mt-4">{renderGraph()}</div>

            <div className="mt-4">
              {feedback.map((f, i) => <p key={i}>{f}</p>)}
            </div>

            <div className="mt-6">
              <p>Sesiones: {user.sessions.length}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
