import React, { useRef, useState, useEffect } from "react";

// ===== IA =====
function buildOlympicModel() {
  return { powerTrend: [] };
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

function detectFatigue(history) {
  if (history.length < 5) return 0;
  const last = history.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const prev = history.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
  return prev - last;
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState("erg");

  const [user, setUser] = useState({ name: "Athlete", sessions: [] });

  const [spm, setSpm] = useState(0);
  const strokeTimesRef = useRef([]);

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const bestStrokeRef = useRef(null);
  const chartRef = useRef([]);

  const olympicAIRef = useRef(buildOlympicModel());

  const models = {
    erg: { catch: 75 },
    coastal: { catch: 78 },
    banco_movil: { catch: 80 },
    banco_fijo: { catch: 85 },
    rp3: { catch: 70 },
  };

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
    v.paused ? v.play() : v.pause();
    setIsPlaying(!v.paused);
  };

  const stepFrame = () => {
    const v = videoRef.current;
    v.pause();
    setIsPlaying(false);
    v.currentTime += 0.03;
  };

  // LOCAL STORAGE
  useEffect(() => {
    localStorage.setItem("rowxia_user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem("rowxia_user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!videoSrc || !window.Pose) return;

    const pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });

    pose.onResults((res) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

      // 🔥 HISTORIAL (GRÁFICA)
      const history = historyRef.current;
      history.push({ kneeAngle, trunkAngle, elbowAngle });
      if (history.length > 30) history.shift();

      if (history.length > 2) {
        const prev = history[history.length - 2];
        const curr = history[history.length - 1];

        chartRef.current.push({
          legs: curr.kneeAngle - prev.kneeAngle,
          back: curr.trunkAngle - prev.trunkAngle,
          arms: curr.elbowAngle - prev.elbowAngle,
        });

        if (chartRef.current.length > 80) chartRef.current.shift();
      }

      // DETECTAR PALADA + SPM REAL
      if (kneeAngle < models[mode].catch && strokeRef.current.length > 10) {
        analyzeStroke(strokeRef.current);

        const now = Date.now();
        strokeTimesRef.current.push(now);

        if (strokeTimesRef.current.length > 10)
          strokeTimesRef.current.shift();

        if (strokeTimesRef.current.length > 2) {
          const diff =
            strokeTimesRef.current[
              strokeTimesRef.current.length - 1
            ] - strokeTimesRef.current[0];

          setSpm(Math.round((strokeTimesRef.current.length / diff) * 60000));
        }

        strokeRef.current = [];
      }

      strokeRef.current.push({ kneeAngle, trunkAngle, elbowAngle });

      // 🔥 GHOST STROKE
      if (bestStrokeRef.current) {
        bestStrokeRef.current.forEach((p, i) => {
          if (i % 5 === 0) {
            ctx.beginPath();
            ctx.arc(
              (i / bestStrokeRef.current.length) * canvas.width,
              canvas.height - p.kneeAngle,
              2,
              0,
              2 * Math.PI
            );
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

  function analyzeStroke(stroke) {
    let timingScore = 100;

    const power = estimateAdvancedPower(stroke);

    olympicAIRef.current.powerTrend.push(power);
    if (olympicAIRef.current.powerTrend.length > 20)
      olympicAIRef.current.powerTrend.shift();

    const fatigue = detectFatigue(olympicAIRef.current.powerTrend);

    const finalScore = Math.round(timingScore * 0.6 + power * 0.4);

    if (!bestStrokeRef.current || finalScore > score) {
      bestStrokeRef.current = stroke;
    }

    setUser((prev) => ({
      ...prev,
      sessions: [
        ...prev.sessions,
        { score: finalScore, power, spm },
      ],
    }));

    setScore(finalScore);

    setFeedback([
      `Potencia: ${power}`,
      `SPM: ${spm}`,
      `Fatiga: ${Math.round(fatigue)}`,
    ]);
  }

  // 🔥 GRAFICA ROWERUP STYLE
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
      <div className="flex-1 flex flex-col items-center justify-center">
        {!videoSrc ? (
          <input type="file" accept="video/*" onChange={handleUpload} />
        ) : (
          <>
            <canvas ref={canvasRef} className="rounded mb-4" />
            <video ref={videoRef} src={videoSrc} className="hidden" />

            <div className="flex gap-4">
              <button onClick={togglePlay}>Play</button>
              <button onClick={stepFrame}>Step</button>

              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(user)], {
                    type: "application/json",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "rowxia_data.json";
                  a.click();
                }}
              >
                Exportar
              </button>
            </div>

            <div className="mt-4">{renderGraph()}</div>

            <div className="mt-4">
              {feedback.map((f, i) => (
                <p key={i}>{f}</p>
              ))}
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
