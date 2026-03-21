import React, { useRef, useState, useEffect } from "react";

// ===== 🧬 OLIMPIC + NATIONAL AI =====
function buildOlympicModel() {
  return {
    fatigue: 0,
    powerTrend: [],
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
  spanish: {
    peakLegs: 16,
    peakBack: 11,
    peakArms: 9,
  },
};

function classifyRowerStyle(stroke) {
  let legs = 0,
    back = 0,
    arms = 0;

  stroke.forEach((f) => {
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

  normalized.forEach((f) => {
    error += Math.abs(f.kneeAngle - profile.peakLegs);
    error += Math.abs(f.trunkAngle - profile.peakBack);
    error += Math.abs(f.elbowAngle - profile.peakArms);
  });

  return Math.round(error / normalized.length);
}

function advancedTechnicalErrors(stroke) {
  let errors = [];

  if (stroke.find((f) => f.elbowAngle < 140 && f.kneeAngle < 130))
    errors.push("Brazos demasiado tempranos");

  if (stroke.every((f) => f.kneeAngle < 150))
    errors.push("Drive débil");

  if (stroke.some((f) => f.trunkAngle > 25))
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

  const [user, setUser] = useState({
    name: "Athlete",
    sessions: [],
  });

  const [spm, setSpm] = useState(0);
  const strokeTimesRef = useRef([]);

  const olympicAIRef = useRef(buildOlympicModel());

  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState("erg");

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const bestStrokeRef = useRef(null);
  const chartRef = useRef([]);

  const models = {
    erg: { catch: 75 },
    rp3: { catch: 70 },
    banco_movil: { catch: 80 },
    banco_fijo: { catch: 85 },
    coastal: { catch: 78 },
  };

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

      const knee = lm[26];
      const hip = lm[24];
      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];
      const ankle = lm[28];

      const kneeAngle = Math.abs(knee.y - hip.y) * 180;
      const trunkAngle = Math.abs(shoulder.y - hip.y) * 180;
      const elbowAngle = Math.abs(wrist.y - elbow.y) * 180;

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
    const ratio = calculateDriveRecoveryRatio(stroke);
    const style = classifyRowerStyle(stroke);
    const eliteError = compareToElite(stroke, eliteProfiles.spanish);
    const advancedErrors = advancedTechnicalErrors(stroke);

    olympicAIRef.current.powerTrend.push(power);
    if (olympicAIRef.current.powerTrend.length > 20)
      olympicAIRef.current.powerTrend.shift();

    const fatigue = detectFatigue(olympicAIRef.current.powerTrend);

    const finalScore = Math.round(
      timingScore * 0.4 + power * 0.2 + (100 - eliteError) * 0.4
    );

    const prediction = predictPerformance(finalScore, power, spm);

    if (!bestStrokeRef.current || finalScore > score) {
      bestStrokeRef.current = stroke;
    }

    setUser((prev) => ({
      ...prev,
      sessions: [
        ...prev.sessions,
        { date: new Date().toISOString(), score: finalScore, power, spm },
      ],
    }));

    setScore(finalScore);

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
  }

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
