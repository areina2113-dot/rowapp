import React, { useRef, useState, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [phase, setPhase] = useState("Esperando vídeo...");
  const [feedback, setFeedback] = useState([]);
  const [efficiency, setEfficiency] = useState(0);
  const [strokesCount, setStrokesCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // 🔥 VARIABLES INTERNAS (CLAVE)
  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const lastKneeRef = useRef(null);

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
    if (!v) return;

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

      // 🔴 dibujo
      lm.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
      });

      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];
      const hip = lm[24];
      const knee = lm[26];
      const ankle = lm[28];

      const kneeAngle = getAngle(hip, knee, ankle);
      const trunkAngle = angleToVertical(hip, shoulder);
      const elbowAngle = getAngle(shoulder, elbow, wrist);

      // 🔥 HISTORIAL REAL (NO STATE)
      const history = historyRef.current;
      history.push({ kneeAngle, trunkAngle, elbowAngle });
      if (history.length > 30) history.shift();

      // 🔥 DETECCIÓN DE FASES REAL
      let currentPhase = "Analizando...";

      if (history.length > 5) {
        const prev = history[history.length - 2];
        const curr = history[history.length - 1];

        const kneeVel = curr.kneeAngle - prev.kneeAngle;

        if (curr.kneeAngle < 75 && Math.abs(kneeVel) < 1) {
          currentPhase = "Catch";
        } else if (kneeVel > 0 && curr.kneeAngle < 160) {
          currentPhase = "Drive";
        } else if (curr.kneeAngle >= 160) {
          currentPhase = "Finish";
        } else if (kneeVel < 0) {
          currentPhase = "Recovery";
        }
      }

      setPhase(currentPhase);

      // 🔥 DETECCIÓN DE PALADA REAL
      const lastKnee = lastKneeRef.current;

      if (lastKnee !== null) {
        if (kneeAngle < lastKnee && kneeAngle < 80) {
          if (strokeRef.current.length > 10) {
            analyzeStroke(strokeRef.current);
            setStrokesCount((prev) => prev + 1);
          }
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
  }, [videoSrc]);

  // 🧠 ANÁLISIS REAL
  function analyzeStroke(stroke) {
    let score = 100;
    let errors = [];

    let earlyBack = false;
    let earlyArms = false;

    stroke.forEach((f) => {
      if (f.kneeAngle < 120 && f.trunkAngle > 0) earlyBack = true;
      if (f.trunkAngle < 5 && f.elbowAngle < 150) earlyArms = true;
    });

    if (earlyBack) {
      errors.push("Espalda abre demasiado pronto");
      score -= 30;
    }

    if (earlyArms) {
      errors.push("Brazos tiran demasiado pronto");
      score -= 30;
    }

    if (errors.length === 0) errors.push("Secuencia correcta");

    setFeedback(errors);
    setEfficiency(Math.max(0, score));
  }

  return (
    <div className="min-h-screen flex bg-[#0B1A2B] text-white">

      {/* SIDEBAR */}
      <div className="w-64 bg-black p-6">
        <h1 className="text-yellow-400 text-xl font-bold">ROWXIA</h1>
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

            <div className="mt-4 bg-[#132B45] p-4 rounded w-[400px]">
              <p>Fase: {phase}</p>
              <p>Eficiencia: {efficiency}%</p>
              <p>Paladas: {strokesCount}</p>

              {feedback.map((f, i) => (
                <p key={i} className="text-yellow-400">{f}</p>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
