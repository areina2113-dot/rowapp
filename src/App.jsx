import React, { useRef, useState, useEffect } from "react";

// ✅ FUNCIONES BIOMECÁNICAS (FUERA del componente)
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
  const angle = Math.atan2(dx, dy);
  return (angle * 180) / Math.PI;
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [feedback, setFeedback] = useState([]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

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

      if (results.poseLandmarks) {
        const lm = results.poseLandmarks;

        // 🔴 Dibujar puntos
        lm.forEach((point) => {
          ctx.beginPath();
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            5,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = "red";
          ctx.fill();
        });

        // 🧠 ANÁLISIS BIOMECÁNICO
        const A = lm[27];
        const K = lm[25];
        const H = lm[23];
        const S = lm[11];
        const E = lm[13];
        const W = lm[15];

        const kneeAngle = getAngle(H, K, A);
        const trunkAngle = angleToVertical(H, S);
        const elbowAngle = getAngle(S, E, W);

        let errors = [];

        if (kneeAngle < 95 && Math.abs(trunkAngle + 15) > 5) {
          errors.push("Catch incorrecto: espalda mal posicionada");
        }

        if (kneeAngle < 120 && trunkAngle > -5) {
          errors.push("Apertura prematura de espalda");
        }

        if (trunkAngle < 0 && elbowAngle < 160) {
          errors.push("Brazos demasiado tempranos");
        }

        setFeedback(errors);
      }
    });

    const video = videoRef.current;

    video.onloadeddata = () => {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const processFrame = async () => {
        if (video.paused || video.ended) return;
        await pose.send({ image: video });
        requestAnimationFrame(processFrame);
      };

      video.play();
      processFrame();
    };
  }, [videoSrc]);

  return (
    <div className="min-h-screen bg-blue-500 p-6 text-center text-white">
      <h1 className="text-4xl font-bold mb-6">RowXia</h1>

      <input type="file" accept="video/*" onChange={handleUpload} />

      <div className="mt-6">
        <video ref={videoRef} src={videoSrc} className="hidden" />
        <canvas ref={canvasRef} className="rounded shadow-lg" />
      </div>

      {/* 🧾 FEEDBACK */}
      <div className="mt-6 bg-white text-black p-4 rounded max-w-xl mx-auto">
        <h2 className="font-bold mb-2">Análisis técnico</h2>
        {feedback.length === 0 ? (
          <p>✔ Técnica correcta</p>
        ) : (
          feedback.map((f, i) => <p key={i}>❌ {f}</p>)
        )}
      </div>
    </div>
  );
}
