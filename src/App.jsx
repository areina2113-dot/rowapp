import React, { useRef, useState, useEffect } from "react";

// 🧠 ANALISIS POR PALADA
function analyzeStroke(stroke) {
  if (stroke.length < 5) return null;

  let errors = [];
  let score = 100;

  let earlyBack = false;
  let earlyArms = false;

  for (let i = 1; i < stroke.length; i++) {
    const prev = stroke[i - 1];
    const curr = stroke[i];

    if (curr.kneeAngle < 120 && curr.trunkAngle > 0) {
      earlyBack = true;
    }

    if (curr.trunkAngle < 5 && curr.elbowAngle < 150) {
      earlyArms = true;
    }
  }

  if (earlyBack) {
    errors.push("Apertura prematura de espalda");
    score -= 30;
  }

  if (earlyArms) {
    errors.push("Brazos demasiado tempranos");
    score -= 30;
  }

  if (errors.length === 0) {
    errors.push("Secuencia correcta");
  }

  return {
    score: Math.max(0, score),
    errors,
  };
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [mode, setMode] = useState("erg");
  const [phase, setPhase] = useState("Esperando...");
  const [feedback, setFeedback] = useState([]);
  const [efficiency, setEfficiency] = useState(100);

  const [history, setHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // PALADAS
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [lastKnee, setLastKnee] = useState(null);

  // 📂 SUBIR VIDEO
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoSrc(URL.createObjectURL(file));
  };

  // 🎮 CONTROLES VIDEO
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = () => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setIsPlaying(false);
    video.currentTime += 0.03;
  };

  // 📐 ANGULOS
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

    pose.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (!results.poseLandmarks) return;

      const lm = results.poseLandmarks;

      lm.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
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

      // HISTORIAL
      const frameData = { kneeAngle, trunkAngle, elbowAngle };
      setHistory((prev) => [...prev.slice(-30), frameData]);

      // PALADA ACTUAL
      setCurrentStroke((prev) => [...prev, frameData]);

      // DETECTAR NUEVA PALADA
      if (lastKnee !== null) {
        if (kneeAngle < lastKnee && kneeAngle < 80) {
          if (currentStroke.length > 10) {
            setStrokes((prev) => [...prev, currentStroke]);
          }
          setCurrentStroke([]);
        }
      }
      setLastKnee(kneeAngle);

      // FASES
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

      // ANALISIS POR PALADA
      if (strokes.length > 0) {
        const analysis = analyzeStroke(strokes[strokes.length - 1]);
        if (analysis) {
          setFeedback(analysis.errors);
          setEfficiency(analysis.score);
        }
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
  }, [videoSrc, strokes]);

  return (
    <div className="min-h-screen flex bg-[#0B1A2B] text-white">
      <div className="w-64 bg-[#0E2238] p-6">
        <h1 className="text-yellow-400 font-bold">ROWXIA</h1>

        <select
          className="mt-4 p-2 text-black"
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="erg">Ergómetro</option>
          <option value="coastal">Coastal</option>
          <option value="trainera">Trainera</option>
        </select>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {!videoSrc ? (
          <input type="file" accept="video/*" onChange={handleUpload} />
        ) : (
          <>
            <canvas ref={canvasRef} />
            <video ref={videoRef} src={videoSrc} className="hidden" />

            <div className="flex gap-4 mt-4">
              <button onClick={togglePlay}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button onClick={stepFrame}>Step</button>
            </div>

            <div className="mt-4 bg-[#132B45] p-4 rounded">
              <p>Fase: {phase}</p>
              <p>Eficiencia: {efficiency}%</p>
              <p>Paladas: {strokes.length}</p>

              {feedback.map((f, i) => (
                <p key={i}>{f}</p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
