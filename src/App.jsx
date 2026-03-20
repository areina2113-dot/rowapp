import React, { useRef, useState, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [phase, setPhase] = useState("Esperando...");
  const [efficiency, setEfficiency] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState("erg");

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const lastKneeRef = useRef(null);
  const chartRef = useRef([]);

  const models = {
    erg: { catch: 75 },
    trainera: { catch: 85 },
    coastal: { catch: 80 },
  };

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
      const draw = (a, b) => {
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 3;
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

      // 🔥 VELOCIDADES (CLAVE PARA GRAFICA)
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

      // 🔥 FASES
      let currentPhase = "Analizando...";
      if (history.length > 5) {
        const prev = history[history.length - 2];
        const curr = history[history.length - 1];
        const vel = curr.kneeAngle - prev.kneeAngle;

        if (curr.kneeAngle < models[mode].catch && Math.abs(vel) < 1)
          currentPhase = "Catch";
        else if (vel > 0) currentPhase = "Drive";
        else if (curr.kneeAngle > 160) currentPhase = "Finish";
        else if (vel < 0) currentPhase = "Recovery";
      }

      setPhase(currentPhase);

      // 🔥 DETECTAR PALADA
      const lastKnee = lastKneeRef.current;

      if (lastKnee !== null) {
        if (kneeAngle < lastKnee && kneeAngle < models[mode].catch) {
          analyzeStroke(strokeRef.current);
          strokeRef.current = [];
        }
      }

      strokeRef.current.push({ kneeAngle, trunkAngle, elbowAngle });
      lastKneeRef.current = kneeAngle;
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
    let score = 100;
    let errors = [];

    stroke.forEach((f) => {
      if (f.kneeAngle < 120 && f.trunkAngle > 0) {
        errors.push("Espalda abre pronto");
        score -= 25;
      }
      if (f.trunkAngle < 5 && f.elbowAngle < 150) {
        errors.push("Brazos tiran pronto");
        score -= 25;
      }
    });

    if (errors.length === 0) errors.push("Secuencia correcta");

    setEfficiency(score);
    setFeedback(errors);
  }

  // 🔥 GRAFICA PRO (tipo RowerUp)
  const renderGraph = () => {
    const data = chartRef.current;
    const width = 500;
    const height = 180;

    const max = 20;
    const scaleX = width / (data.length || 1);
    const scaleY = 3;

    const buildPath = (key) =>
      data
        .map((d, i) => {
          const x = i * scaleX;
          const y = height / 2 - d[key] * scaleY;
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    return (
      <svg width={width} height={height} className="bg-[#0E2238] rounded">
        <path d={buildPath("legs")} stroke="#00FF88" fill="none" />
        <path d={buildPath("back")} stroke="#3399FF" fill="none" />
        <path d={buildPath("arms")} stroke="#FF00AA" fill="none" />
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
          <option value="erg">Ergómetro</option>
          <option value="trainera">Trainera</option>
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

            <div className="mt-4 bg-[#132B45] p-4 rounded w-[500px]">
              <p>Fase: {phase}</p>
              <p>Eficiencia: {efficiency}%</p>

              {feedback.map((f, i) => (
                <p key={i} className="text-yellow-400">{f}</p>
              ))}

              <div className="mt-4">
                <p className="text-sm mb-2">Speed & Sequence</p>
                {renderGraph()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
