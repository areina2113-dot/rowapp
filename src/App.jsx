import React, { useRef, useState, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [phase, setPhase] = useState("Esperando video...");
  const [feedback, setFeedback] = useState([]);
  const [efficiency, setEfficiency] = useState(100);

  // 📂 SUBIR VIDEO
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  // 📐 FUNCIONES DE ÁNGULOS
  function getAngle(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };

    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
    const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);

    const angle = Math.acos(dot / (magAB * magCB));
    return (angle * 180) / Math.PI;
  }

  function angleToVertical(A, B) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }

  // 🤖 IA
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

      // 🔴 DIBUJAR PUNTOS
      lm.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();
      });

      // 🧠 KEYPOINTS (lado derecho)
      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];
      const hip = lm[24];
      const knee = lm[26];
      const ankle = lm[28];

      // 📐 ÁNGULOS
      const kneeAngle = getAngle(hip, knee, ankle);
      const trunkAngle = angleToVertical(hip, shoulder);
      const elbowAngle = getAngle(shoulder, elbow, wrist);

      // 🟡 DETECCIÓN DE FASES
      let currentPhase = "Analizando...";

      if (kneeAngle < 70) {
        currentPhase = "Catch";
      } else if (kneeAngle < 160 && trunkAngle < 10) {
        currentPhase = "Drive";
      } else if (kneeAngle >= 160 && trunkAngle > 5) {
        currentPhase = "Finish";
      } else {
        currentPhase = "Recovery";
      }

      setPhase(currentPhase);

      // ⚠️ FEEDBACK REAL
      let errors = [];

      if (kneeAngle < 130 && trunkAngle > 0) {
        errors.push("❌ Abres la espalda demasiado pronto");
      }

      if (elbowAngle < 150 && kneeAngle < 140) {
        errors.push("❌ Tiras con brazos demasiado pronto");
      }

      if (trunkAngle > 20) {
        errors.push("❌ Exceso de inclinación hacia atrás");
      }

      if (errors.length === 0) {
        errors.push("✅ Buena técnica");
      }

      setFeedback(errors);

      // 📊 EFICIENCIA
      let score = 100;
      if (kneeAngle < 130 && trunkAngle > 0) score -= 30;
      if (elbowAngle < 150 && kneeAngle < 140) score -= 30;
      if (trunkAngle > 20) score -= 20;

      setEfficiency(Math.max(0, score));
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
      loop();
    };
  }, [videoSrc]);

  // 🎨 UI
  return (
    <div className="min-h-screen flex bg-[#0B1A2B] text-white">

      {/* SIDEBAR */}
      <div className="w-64 bg-[#0E2238] p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold mb-6 text-yellow-400">ROWXIA</h1>

          <nav className="space-y-4">
            <button className="w-full text-left bg-yellow-400 text-black px-4 py-2 rounded">
              Dashboard
            </button>
            <button className="w-full text-left hover:text-yellow-400">
              New Session
            </button>
          </nav>
        </div>

        <p className="text-xs opacity-50">ENGLISH</p>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col items-center justify-center">

        {!videoSrc ? (
          <div className="text-center">
            <h2 className="text-2xl mb-4">No sessions yet</h2>

            <input type="file" accept="video/*" onChange={handleUpload} />

            <p className="opacity-60 mt-2">
              Upload a rowing video to start
            </p>
          </div>
        ) : (
          <>
            <canvas ref={canvasRef} className="rounded mb-6" />
            <video ref={videoRef} src={videoSrc} className="hidden" />

            <div className="bg-[#132B45] p-6 rounded-xl w-[400px] text-center">

              <h2 className="text-lg">Fase</h2>
              <p className="text-2xl text-yellow-400">{phase}</p>

              <h2 className="mt-4">Eficiencia</h2>
              <p>{efficiency}%</p>

              <div className="mt-4">
                {feedback.map((f, i) => (
                  <p key={i}>{f}</p>
                ))}
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  );
}
