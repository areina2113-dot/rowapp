import React, { useEffect, useRef, useState } from "react";

/* =========================
   Helpers / model utilities
========================= */

const DEFAULT_USER = {
  name: "Athlete",
  sessions: [],
};

function getDefaultUser() {
  return { ...DEFAULT_USER, sessions: [] };
}

function loadStoredUser() {
  try {
    if (typeof window === "undefined") return getDefaultUser();
    const raw = window.localStorage.getItem("rowxia_user");
    return raw ? JSON.parse(raw) : getDefaultUser();
  } catch {
    return getDefaultUser();
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gaussian(x, mu, sigma, amp = 1) {
  const z = (x - mu) / sigma;
  return amp * Math.exp(-0.5 * z * z);
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function safeIndexOfMax(values) {
  if (!values.length) return -1;
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[idx]) idx = i;
  }
  return idx;
}

function safeIndexOfMin(values) {
  if (!values.length) return -1;
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[idx]) idx = i;
  }
  return idx;
}

function resampleCurve(curve, points = 60) {
  if (!curve || curve.length === 0) return [];
  if (curve.length === 1) {
    return Array.from({ length: points }, (_, i) => ({
      ...curve[0],
      phase: i / Math.max(1, points - 1),
    }));
  }

  const out = [];
  for (let i = 0; i < points; i++) {
    const t = (i * (curve.length - 1)) / Math.max(1, points - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(curve.length - 1, i0 + 1);
    const frac = t - i0;

    const a = curve[i0];
    const b = curve[i1];

    out.push({
      phase: i / Math.max(1, points - 1),
      legs: lerp(a.legs, b.legs, frac),
      back: lerp(a.back, b.back, frac),
      arms: lerp(a.arms, b.arms, frac),
    });
  }
  return out;
}

function buildAverageCurve(curves, points = 60) {
  if (!curves || curves.length === 0) return [];
  const resampled = curves.map((c) => resampleCurve(c, points));
  const out = [];

  for (let i = 0; i < points; i++) {
    let legs = 0;
    let back = 0;
    let arms = 0;
    let n = 0;

    resampled.forEach((curve) => {
      if (curve[i]) {
        legs += curve[i].legs;
        back += curve[i].back;
        arms += curve[i].arms;
        n += 1;
      }
    });

    out.push({
      phase: i / Math.max(1, points - 1),
      legs: n ? legs / n : 0,
      back: n ? back / n : 0,
      arms: n ? arms / n : 0,
    });
  }

  return out;
}

function compareCurves(a, b) {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;

  let total = 0;
  for (let i = 0; i < len; i++) {
    total += Math.abs(a[i].legs - b[i].legs);
    total += Math.abs(a[i].back - b[i].back);
    total += Math.abs(a[i].arms - b[i].arms);
  }
  return total / len;
}

function curveMaxAbs(curve) {
  if (!curve || !curve.length) return 1;
  let m = 1;
  curve.forEach((p) => {
    m = Math.max(m, Math.abs(p.legs || 0), Math.abs(p.back || 0), Math.abs(p.arms || 0));
  });
  return m;
}

function buildPath(curve, key, width, height, maxAbs) {
  if (!curve || curve.length === 0) return "";
  const mid = height / 2;
  const scale = (height * 0.35) / Math.max(1, maxAbs);

  return curve
    .map((p, i) => {
      const x = p.phase * width;
      const y = mid - (p[key] || 0) * scale;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildHandlePath(stroke, points = 60) {
  if (!stroke || stroke.length === 0) return [];
  const simplified = stroke.map((s, i) => ({
    phase: i / Math.max(1, stroke.length - 1),
    x: s.points?.wrist?.x ?? 0.5,
    y: s.points?.wrist?.y ?? 0.5,
  }));
  if (simplified.length <= points) return simplified;

  const out = [];
  for (let i = 0; i < points; i++) {
    const t = (i * (simplified.length - 1)) / Math.max(1, points - 1);
    const i0 = Math.floor(t);
    const i1 = Math.min(simplified.length - 1, i0 + 1);
    const frac = t - i0;
    out.push({
      phase: i / Math.max(1, points - 1),
      x: lerp(simplified[i0].x, simplified[i1].x, frac),
      y: lerp(simplified[i0].y, simplified[i1].y, frac),
    });
  }
  return out;
}

function computeVelocityCurve(stroke) {
  if (!stroke || stroke.length === 0) return [];
  return stroke.map((s, i) => {
    const prev = stroke[i - 1] || s;
    return {
      phase: i / Math.max(1, stroke.length - 1),
      legs: i === 0 ? 0 : s.kneeAngle - prev.kneeAngle, // leg extension
      back: i === 0 ? 0 : s.trunkAngle - prev.trunkAngle, // body open
      arms: i === 0 ? 0 : prev.elbowAngle - s.elbowAngle, // pull closes elbow
    };
  });
}

function estimateAdvancedPower(stroke) {
  if (!stroke || stroke.length < 2) return 0;

  let power = 0;
  for (let i = 1; i < stroke.length; i++) {
    power += Math.abs(stroke[i].kneeAngle - stroke[i - 1].kneeAngle) * 0.55;
    power += Math.abs(stroke[i].trunkAngle - stroke[i - 1].trunkAngle) * 0.30;
    power += Math.abs(stroke[i].elbowAngle - stroke[i - 1].elbowAngle) * 0.15;
  }
  return Math.round(power);
}

function computeDriveRecoveryRatio(stroke) {
  if (!stroke || stroke.length < 3) return 0.5;
  const knees = stroke.map((s) => s.kneeAngle);
  const minIdx = safeIndexOfMin(knees);
  const maxIdxAfter = safeIndexOfMax(knees.slice(minIdx)) + minIdx;
  const drive = Math.max(1, maxIdxAfter - minIdx);
  const recovery = Math.max(1, stroke.length - drive);
  return drive / recovery;
}

function detectFatigue(powerHistory) {
  if (!powerHistory || powerHistory.length < 6) return 0;
  const last = avg(powerHistory.slice(-3));
  const prev = avg(powerHistory.slice(-6, -3));
  return Math.max(0, prev - last);
}

function predictPerformance(finalScore, powerScore, spm) {
  const spmScore = clamp((spm - 18) * 4, 0, 100);
  return clamp(Math.round(finalScore * 0.5 + powerScore * 0.25 + spmScore * 0.25), 0, 100);
}

function classifyRowerStyle(stroke) {
  if (!stroke || stroke.length < 2) return "Sin datos";

  const totals = stroke.reduce(
    (acc, s) => {
      acc.legs += Math.abs(s.kneeAngle - 150);
      acc.back += Math.abs(s.trunkAngle);
      acc.arms += Math.abs(s.elbowAngle - 150);
      return acc;
    },
    { legs: 0, back: 0, arms: 0 }
  );

  if (totals.legs > totals.back && totals.legs > totals.arms) return "Piernas dominante";
  if (totals.back > totals.legs && totals.back > totals.arms) return "Espalda dominante";
  return "Brazos dominante";
}

function getTechniqueLibrary() {
  return {
    rowerg: {
      label: "RowErg",
      catch: 75,
      driveRatio: 0.42,
      sequence: ["legs", "back", "arms"],
      weights: { legs: 1.0, back: 0.85, arms: 0.55 },
    },
    rp3: {
      label: "RP3",
      catch: 70,
      driveRatio: 0.44,
      sequence: ["legs", "back", "arms"],
      weights: { legs: 0.95, back: 0.9, arms: 0.6 },
    },
    banco_movil: {
      label: "Banco móvil",
      catch: 80,
      driveRatio: 0.45,
      sequence: ["legs", "back", "arms"],
      weights: { legs: 1.0, back: 0.9, arms: 0.6 },
    },
    banco_fijo: {
      label: "Banco fijo",
      catch: 85,
      driveRatio: 0.52,
      sequence: ["back", "arms"],
      weights: { legs: 0.2, back: 1.0, arms: 0.9 },
    },
    coastal: {
      label: "Coastal rowing",
      catch: 78,
      driveRatio: 0.47,
      sequence: ["legs", "back", "arms"],
      weights: { legs: 0.95, back: 0.85, arms: 0.6 },
    },
  };
}

function buildIdealVelocityCurve(mode, points = 60) {
  const lib = getTechniqueLibrary()[mode] || getTechniqueLibrary().rowerg;
  const out = [];

  for (let i = 0; i < points; i++) {
    const p = i / Math.max(1, points - 1);

    const legs = gaussian(p, lib.sequence[0] === "back" ? 0.18 : 0.16, 0.10, lib.weights.legs * 14);
    const back = gaussian(p, lib.sequence[0] === "back" ? 0.30 : 0.42, 0.11, lib.weights.back * 10);
    const arms = gaussian(p, lib.sequence[0] === "back" ? 0.58 : 0.72, 0.09, lib.weights.arms * 8);

    out.push({
      phase: p,
      legs,
      back,
      arms,
    });
  }
  return out;
}

function findPeakIndex(curve, key) {
  if (!curve || curve.length === 0) return -1;
  let idx = 0;
  for (let i = 1; i < curve.length; i++) {
    if ((curve[i][key] || 0) > (curve[idx][key] || 0)) idx = i;
  }
  return idx;
}

function detectTechniqueErrors(stroke, actualCurve, idealCurve, mode) {
  const lib = getTechniqueLibrary()[mode] || getTechniqueLibrary().rowerg;
  const errors = [];

  if (!stroke || stroke.length < 6) return errors;

  const legPeak = findPeakIndex(actualCurve, "legs");
  const backPeak = findPeakIndex(actualCurve, "back");
  const armPeak = findPeakIndex(actualCurve, "arms");

  if (lib.sequence[0] === "back") {
    if (!(backPeak < armPeak)) errors.push("Secuencia rota: espalda → brazos");
    if (actualCurve[legPeak]?.legs > 3) errors.push("Exceso de piernas para banco fijo");
  } else {
    if (!(legPeak < backPeak && backPeak < armPeak)) {
      errors.push("Secuencia rota: piernas → espalda → brazos");
    }
    if (backPeak < legPeak) errors.push("Espalda abre demasiado pronto");
    if (armPeak < backPeak) errors.push("Brazos demasiado tempranos");
  }

  const kneeAngles = stroke.map((s) => s.kneeAngle);
  const kneeRange = Math.max(...kneeAngles) - Math.min(...kneeAngles);
  if (kneeRange < 35) errors.push("Drive incompleto / poca extensión");
  if (stroke.some((s) => s.trunkAngle > 28)) errors.push("Layback excesivo");
  if (stroke.some((s) => s.elbowAngle < 120 && s.kneeAngle < 135)) errors.push("Brazos demasiado pronto");

  const ratio = computeDriveRecoveryRatio(stroke);
  if (ratio < lib.driveRatio * 0.72) errors.push("Drive demasiado corto");
  if (ratio > lib.driveRatio * 1.35) errors.push("Recovery demasiado lento");

  // Graph-based mismatch labels
  const markers = detectGraphErrors(actualCurve, idealCurve);
  markers.forEach((m) => {
    if (!errors.includes(m.label)) errors.push(m.label);
  });

  return errors;
}

function detectGraphErrors(actualCurve, idealCurve) {
  const markers = [];
  if (!actualCurve.length || !idealCurve.length) return markers;

  const len = Math.min(actualCurve.length, idealCurve.length);
  const threshold = 6;

  for (let i = 0; i < len; i++) {
    const dLegs = (actualCurve[i].legs || 0) - (idealCurve[i].legs || 0);
    const dBack = (actualCurve[i].back || 0) - (idealCurve[i].back || 0);
    const dArms = (actualCurve[i].arms || 0) - (idealCurve[i].arms || 0);

    const absMax = Math.max(Math.abs(dLegs), Math.abs(dBack), Math.abs(dArms));
    if (absMax <= threshold) continue;

    let component = "legs";
    let diff = dLegs;
    if (Math.abs(dBack) >= Math.abs(dLegs) && Math.abs(dBack) >= Math.abs(dArms)) {
      component = "back";
      diff = dBack;
    } else if (Math.abs(dArms) >= Math.abs(dLegs) && Math.abs(dArms) >= Math.abs(dBack)) {
      component = "arms";
      diff = dArms;
    }

    let label = "Desviación técnica";
    if (component === "legs") label = diff < 0 ? "Pierna corta / drive débil" : "Leg drive brusco";
    if (component === "back") label = diff > 0 ? "Espalda abre demasiado pronto" : "Espalda tarde";
    if (component === "arms") label = diff > 0 ? "Brazos tempranos" : "Brazos tardíos";

    markers.push({
      index: i,
      component,
      label,
      diff,
    });
  }

  // avoid too many markers
  return markers.slice(0, 12);
}

function compareToElite(actualCurve, idealCurve) {
  if (!actualCurve.length || !idealCurve.length) return 0;
  const len = Math.min(actualCurve.length, idealCurve.length);
  let total = 0;

  for (let i = 0; i < len; i++) {
    total += Math.abs(actualCurve[i].legs - idealCurve[i].legs);
    total += Math.abs(actualCurve[i].back - idealCurve[i].back);
    total += Math.abs(actualCurve[i].arms - idealCurve[i].arms);
  }

  return total / len;
}

function buildGraphLabelAtIndex(curve, index, component) {
  const item = curve[index];
  if (!item) return null;
  const val = item[component] || 0;
  return { phase: item.phase, value: val };
}
function smooth(value, prev, alpha = 0.7) {
  if (prev === null) return value;
  return alpha * prev + (1 - alpha) * value;
}
const spmSmoothRef = useRef(null);
/* =========================
   Main App
========================= */

function buildOlympicModel() {
  return {
    fatigue: 0,
    powerTrend: [],
    rhythmHistory: [],
  };
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoSrc, setVideoSrc] = useState(null);
  const [user, setUser] = useState(() => loadStoredUser());

  const [mode, setMode] = useState("rowerg");
  const [phase, setPhase] = useState("Esperando...");
  const [score, setScore] = useState(0);
  const [timingScore, setTimingScore] = useState(0);
  const [powerValue, setPowerValue] = useState(0);
  const [spm, setSpm] = useState(0);
  const [ratioValue, setRatioValue] = useState(0);
  const [eliteGap, setEliteGap] = useState(0);
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [fatigueValue, setFatigueValue] = useState(0);
  const [predictionValue, setPredictionValue] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [feedback, setFeedback] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ghostPhase, setGhostPhase] = useState(0);
  const [bestStrokeVersion, setBestStrokeVersion] = useState(0);

  const [graphStrokeCurve, setGraphStrokeCurve] = useState([]);
  const [graphIdealCurve, setGraphIdealCurve] = useState(buildIdealVelocityCurve("rowerg", 60));
  const [graphUserAvgCurve, setGraphUserAvgCurve] = useState([]);
  const [graphHandlePath, setGraphHandlePath] = useState([]);
  const [graphErrorMarkers, setGraphErrorMarkers] = useState([]);

  const historyRef = useRef([]);
  const strokeRef = useRef([]);
  const bestStrokeRef = useRef(null);
  const strokeTimesRef = useRef([]);
  const olympicAIRef = useRef(buildOlympicModel());
  const userModelRef = useRef({
    strokes: [],
    avgCurve: null,
    bestCurves: [],
  });
  const bestScoreRef = useRef(-Infinity);
  const lastFrameRef = useRef(null);

  const techniqueLibrary = getTechniqueLibrary();
  const currentProfile = techniqueLibrary[mode] || techniqueLibrary.rowerg;
const smoothRef = useRef({
  knee: null,
  trunk: null,
  elbow: null,
});
  useEffect(() => {
    try {
      window.localStorage.setItem("rowxia_user", JSON.stringify(user));
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    setGraphIdealCurve(buildIdealVelocityCurve(mode, 60));
  }, [mode]);

  useEffect(() => {
    let raf = null;

    if (!isPlaying && bestStrokeRef.current && bestStrokeRef.current.length > 2) {
      const tick = () => {
        setGhostPhase((p) => {
          const next = p + 0.008;
          return next >= 1 ? 0 : next;
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      setGhostPhase(0);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isPlaying, bestStrokeVersion]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoSrc(URL.createObjectURL(file));
    setPhase("Esperando...");
    setFeedback([]);
    setScore(0);
    setTimingScore(0);
    setPowerValue(0);
    setSpm(0);
    setRatioValue(0);
    setEliteGap(0);
    setConsistencyScore(0);
    setFatigueValue(0);
    setPredictionValue(0);
    setGraphStrokeCurve([]);
    setGraphUserAvgCurve(userModelRef.current.avgCurve || []);
    setGraphHandlePath([]);
    setGraphErrorMarkers([]);
    setBestScore(0);
    bestScoreRef.current = -Infinity;
    bestStrokeRef.current = null;
    strokeRef.current = [];
    strokeTimesRef.current = [];
    lastFrameRef.current = null;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => {});
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
    const denom = Math.max(1e-6, magAB * magCB);
    const cos = clamp(dot / denom, -1, 1);
    return (Math.acos(cos) * 180) / Math.PI;
  }

  function angleToVertical(A, B) {
    return (Math.atan2(B.x - A.x, B.y - A.y) * 180) / Math.PI;
  }

  function finalizeStroke(stroke) {
    if (!stroke || stroke.length < 10) return;

    const actualCurve = computeVelocityCurve(stroke);
    const idealCurve = buildIdealVelocityCurve(mode, actualCurve.length || 60);
    const resampledActual = resampleCurve(actualCurve, 60);
    const resampledIdeal = resampleCurve(idealCurve, 60);
    const handlePath = buildHandlePath(stroke, 60);

    const power = estimateAdvancedPower(stroke);
    const powerScore = clamp(power * 1.25, 0, 100);

    olympicAIRef.current.powerTrend.push(powerScore);
    if (olympicAIRef.current.powerTrend.length > 30) {
      olympicAIRef.current.powerTrend.shift();
    }

    const fatigue = detectFatigue(olympicAIRef.current.powerTrend);

    const ratio = computeDriveRecoveryRatio(stroke);
    const ratioTarget = currentProfile.driveRatio;
    const rhythmScore = clamp(100 - Math.abs(ratio - ratioTarget) * 250, 0, 100);

    const eliteError = compareToElite(resampledActual, resampledIdeal);
    const eliteScore = clamp(100 - eliteError * 4, 0, 100);

    const sequenceErrors = detectTechniqueErrors(stroke, resampledActual, resampledIdeal, mode);
    const timingPenalty = clamp(sequenceErrors.length * 12, 0, 60);
    const timing = clamp(100 - timingPenalty, 0, 100);

    const userAvg = userModelRef.current.avgCurve;
    const consistency = userAvg && userAvg.length
      ? clamp(100 - compareCurves(resampledActual, userAvg) * 4, 0, 100)
      : 85;

    const fatiguePenalty = clamp(fatigue * 1.8, 0, 18);

    const finalScore = clamp(
      Math.round(
        timing * 0.28 +
          powerScore * 0.22 +
          eliteScore * 0.20 +
          rhythmScore * 0.15 +
          consistency * 0.15 -
          fatiguePenalty
      ),
      0,
      100
    );

    const spmScore = clamp((spm - 18) * 4, 0, 100);
    const prediction = predictPerformance(finalScore, powerScore, spm);

    // Learn the user over time
    userModelRef.current.strokes.push(resampledActual);
    if (userModelRef.current.strokes.length > 25) {
      userModelRef.current.strokes.shift();
    }
    const avgCurve = buildAverageCurve(userModelRef.current.strokes, 60);
    userModelRef.current.avgCurve = avgCurve;
//Main Page
     const [showIntro, setShowIntro] = useState(true);

     if (showIntro) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1A2B] text-white">
      <img src="/logo.png" alt="RowXia" className="w-32 mb-6" />

      <h1 className="text-3xl font-bold text-yellow-400">
        ROWXIA
      </h1>

      <p className="text-white/60 mt-2">
        Understand your stroke
      </p>

      <button
        onClick={() => setShowIntro(false)}
        className="mt-6 bg-yellow-400 text-black px-6 py-2 rounded-xl font-semibold"
      >
        Empezar
      </button>
    </div>
  );
}
     
    // Update best stroke
    if (finalScore > bestScoreRef.current) {
      bestScoreRef.current = finalScore;
      setBestScore(finalScore);
      bestStrokeRef.current = stroke.map((s) => ({ ...s }));
      setBestStrokeVersion((v) => v + 1);
    } else if (bestStrokeRef.current) {
      setBestScore(Math.max(bestScoreRef.current, bestScore));
    }

    // Save stroke timestamps for SPM
   strokeTimesRef.current.push(Date.now());
if (strokeTimesRef.current.length > 12) strokeTimesRef.current.shift();

if (strokeTimesRef.current.length > 3) {
  const first = strokeTimesRef.current[0];
  const last = strokeTimesRef.current[strokeTimesRef.current.length - 1];
  const strokes = strokeTimesRef.current.length - 1;

  const rawSpm = (strokes / (last - first)) * 60000;

  const smoothSpm = smooth(rawSpm, spmSmoothRef.current, 0.85);
  spmSmoothRef.current = smoothSpm;

  setSpm(Math.round(smoothSpm));
}

    // Session log (stroke-based)
    setUser((prev) => {
      const next = {
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            date: new Date().toISOString(),
            mode,
            score: finalScore,
            timing,
            powerScore,
            spm,
            ratio,
            eliteScore,
            consistency,
            fatigue,
          },
        ],
      };
      if (next.sessions.length > 200) {
        next.sessions = next.sessions.slice(-200);
      }
      return next;
    });

    // Graph state
    setGraphStrokeCurve(resampledActual);
    setGraphIdealCurve(resampledIdeal);
    setGraphUserAvgCurve(avgCurve);
    setGraphHandlePath(handlePath);
    setGraphErrorMarkers(detectGraphErrors(resampledActual, resampledIdeal));

    // UI state
    setTimingScore(timing);
    setPowerValue(power);
    setRatioValue(ratio);
    setEliteGap(eliteError);
    setConsistencyScore(consistency);
    setFatigueValue(Math.round(fatigue));
    setPredictionValue(prediction);
    setScore(finalScore);

    const style = classifyRowerStyle(stroke);
    const coachTips = [];

    if (fatigue > 10) coachTips.push("Fatiga detectada: baja el ritmo.");
    if (ratio < currentProfile.driveRatio * 0.75) coachTips.push("Drive demasiado corto.");
    if (ratio > currentProfile.driveRatio * 1.35) coachTips.push("Recovery demasiado lento.");
    if (power < 30) coachTips.push("Falta potencia en la conexión.");
    if (timing < 70) coachTips.push("Timing aún irregular.");

    setFeedback([
      ...sequenceErrors,
      ...coachTips,
      `Estilo dominante: ${style}`,
      `Potencia estimada: ${power}`,
      `SPM: ${spm}`,
      `Ratio drive/recovery: ${ratio.toFixed(2)}`,
      `Error vs élite: ${eliteError.toFixed(1)}`,
      `Predicción rendimiento: ${prediction}`,
    ]);
  }

  useEffect(() => {
    if (!videoSrc || !window.Pose) return;

    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
    });

    pose.onResults((res) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(res.image, 0, 0, canvas.width, canvas.height);

      if (!res.poseLandmarks) return;

      const lm = res.poseLandmarks;

      const shoulder = lm[12];
      const elbow = lm[14];
      const wrist = lm[16];
      const hip = lm[24];
      const knee = lm[26];
      const ankle = lm[28];

      const rawKnee = getAngle(hip, knee, ankle);
const rawTrunk = angleToVertical(hip, shoulder);
const rawElbow = getAngle(shoulder, elbow, wrist);

const kneeAngle = smooth(rawKnee, smoothRef.current.knee);
const trunkAngle = smooth(rawTrunk, smoothRef.current.trunk);
const elbowAngle = smooth(rawElbow, smoothRef.current.elbow);

smoothRef.current = {
  knee: kneeAngle,
  trunk: trunkAngle,
  elbow: elbowAngle,
};

      const prev = lastFrameRef.current;

      const sample = {
        kneeAngle,
        trunkAngle,
        elbowAngle,
        legVel: prev ? kneeAngle - prev.kneeAngle : 0,
        backVel: prev ? trunkAngle - prev.trunkAngle : 0,
        armVel: prev ? prev.elbowAngle - elbowAngle : 0,
        points: {
          shoulder: { x: shoulder.x, y: shoulder.y },
          elbow: { x: elbow.x, y: elbow.y },
          wrist: { x: wrist.x, y: wrist.y },
          hip: { x: hip.x, y: hip.y },
          knee: { x: knee.x, y: knee.y },
          ankle: { x: ankle.x, y: ankle.y },
        },
      };

      const isCatch = kneeAngle <= currentProfile.catch;
      const prevCatch = prev ? prev.kneeAngle <= currentProfile.catch : false;

      let currentPhase = "Recovery";
      if (isCatch) currentPhase = "Catch";
      else if (sample.legVel > 0.4) currentPhase = "Drive";
      else if (sample.armVel > 0.4) currentPhase = "Finish";
      else if (sample.backVel > 0.2) currentPhase = "Body swing";

      setPhase(currentPhase);

      // Draw live stickman
      const draw = (a, b, color = "#FFD700", w = 3) => {
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
      };

      draw(shoulder, elbow, "#FFD700", 3);
      draw(elbow, wrist, "#FFD700", 3);
      draw(shoulder, hip, "#FFD700", 3);
      draw(hip, knee, "#FFD700", 3);
      draw(knee, ankle, "#FFD700", 3);

      // Ghost stroke overlay: animated best stroke path
      if (bestStrokeRef.current && bestStrokeRef.current.length > 2) {
        const ghost = bestStrokeRef.current;
        const upto = Math.max(2, Math.floor(ghost.length * ghostPhase));

        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = "rgba(0,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);

        for (let i = 1; i < upto; i++) {
          const a = ghost[i - 1].points?.wrist;
          const b = ghost[i].points?.wrist;
          if (!a || !b) continue;
          ctx.beginPath();
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
          ctx.stroke();
        }

        ctx.setLineDash([]);

        const idx = Math.min(ghost.length - 1, upto - 1);
        const p = ghost[idx]?.points?.wrist;
        if (p) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,255,255,0.8)";
          ctx.fill();
        }

        ctx.restore();
      }

      // Finalize stroke when a new catch starts
      if (prev && isCatch && !prevCatch && strokeRef.current.length > 10) {
        finalizeStroke(strokeRef.current);
        strokeRef.current = [];
      }

      strokeRef.current.push(sample);
      lastFrameRef.current = sample;
    });

    const video = videoRef.current;
    if (!video) return;

    video.onloadeddata = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const loop = async () => {
        if (video.paused || video.ended) return;
        await pose.send({ image: video });
        requestAnimationFrame(loop);
      };

      video.play().catch(() => {});
      setIsPlaying(true);
      loop();
    };

    return () => {
      video.onloadeddata = null;
    };
  }, [videoSrc, mode]);

  function renderVelocityGraph() {
    const actual = graphStrokeCurve;
    const ideal = graphIdealCurve;
    const userAvg = graphUserAvgCurve;
    const width = 640;
    const height = 250;

    const maxAbs = Math.max(
      curveMaxAbs(actual),
      curveMaxAbs(ideal),
      curveMaxAbs(userAvg),
      1
    );

    const actualPaths = {
      legs: buildPath(actual, "legs", width, height, maxAbs),
      back: buildPath(actual, "back", width, height, maxAbs),
      arms: buildPath(actual, "arms", width, height, maxAbs),
    };

    const idealPaths = {
      legs: buildPath(ideal, "legs", width, height, maxAbs),
      back: buildPath(ideal, "back", width, height, maxAbs),
      arms: buildPath(ideal, "arms", width, height, maxAbs),
    };

    const avgPaths = {
      legs: buildPath(userAvg, "legs", width, height, maxAbs),
      back: buildPath(userAvg, "back", width, height, maxAbs),
      arms: buildPath(userAvg, "arms", width, height, maxAbs),
    };

    return (
      <svg width={width} height={height} className="w-full rounded-2xl bg-[#0E2238]">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={`v-${p}`}
            x1={p * width}
            x2={p * width}
            y1={0}
            y2={height}
            stroke="#ffffff14"
          />
        ))}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={`h-${p}`}
            x1={0}
            x2={width}
            y1={p * height}
            y2={p * height}
            stroke="#ffffff10"
          />
        ))}
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="#ffffff22" />

        {/* labels */}
        <text x={6} y={18} fill="#ffffff88" fontSize="12">Catch</text>
        <text x={width * 0.30} y={18} fill="#ffffff88" fontSize="12">Drive</text>
        <text x={width * 0.62} y={18} fill="#ffffff88" fontSize="12">Finish</text>
        <text x={width * 0.84} y={18} fill="#ffffff88" fontSize="12">Recovery</text>

        {/* Ideal */}
        <path d={idealPaths.legs} stroke="#00FF88" strokeOpacity="0.18" fill="none" strokeWidth="4" />
        <path d={idealPaths.back} stroke="#3399FF" strokeOpacity="0.18" fill="none" strokeWidth="4" />
        <path d={idealPaths.arms} stroke="#FF00AA" strokeOpacity="0.18" fill="none" strokeWidth="4" />

        {/* User average */}
        {userAvg.length > 0 && (
          <>
            <path
              d={avgPaths.legs}
              stroke="#FFFFFF"
              strokeOpacity="0.40"
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <path
              d={avgPaths.back}
              stroke="#FFFFFF"
              strokeOpacity="0.40"
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
            <path
              d={avgPaths.arms}
              stroke="#FFFFFF"
              strokeOpacity="0.40"
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
          </>
        )}

        {/* Actual */}
        <path d={actualPaths.legs} stroke="#00FF88" fill="none" strokeWidth="3" />
        <path d={actualPaths.back} stroke="#3399FF" fill="none" strokeWidth="3" />
        <path d={actualPaths.arms} stroke="#FF00AA" fill="none" strokeWidth="3" />

        {/* Error markers */}
        {graphErrorMarkers.map((m, idx) => {
          const p = actual[m.index];
          if (!p) return null;
          const x = p.phase * width;
          const scale = (height * 0.35) / Math.max(1, maxAbs);
          const y = height / 2 - ((p[m.component] || 0) * scale);
          return (
            <g key={`err-${idx}`}>
              <circle cx={x} cy={y} r="4.5" fill="#ff4d4d" />
              <text x={x + 8} y={Math.max(14, y - 8)} fill="#ffb0b0" fontSize="11">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
   function detectGraphErrors(actualCurve, idealCurve)
   // Detect timing shift (muy clave)
const peakActual = {
  legs: findPeakIndex(actualCurve, "legs"),
  back: findPeakIndex(actualCurve, "back"),
  arms: findPeakIndex(actualCurve, "arms"),
};

const peakIdeal = {
  legs: findPeakIndex(idealCurve, "legs"),
  back: findPeakIndex(idealCurve, "back"),
  arms: findPeakIndex(idealCurve, "arms"),
};

["legs", "back", "arms"].forEach((comp) => {
  const shift = peakActual[comp] - peakIdeal[comp];

  if (Math.abs(shift) > 4) {
    markers.push({
      index: peakActual[comp],
      component: comp,
      label:
        shift > 0
          ? `${comp} tardío`
          : `${comp} demasiado temprano`,
      diff: shift,
    });
  }
});
   // Detect curva demasiado plana o explosiva
const totalEnergy = actualCurve.reduce(
  (acc, p) => acc + Math.abs(p.legs) + Math.abs(p.back) + Math.abs(p.arms),
  0
);

const peakEnergy = Math.max(
  ...actualCurve.map((p) => Math.abs(p.legs) + Math.abs(p.back) + Math.abs(p.arms))
);

if (peakEnergy / totalEnergy > 0.25) {
  markers.push({
    index: findPeakIndex(actualCurve, "legs"),
    component: "legs",
    label: "Drive explosivo (poco sostenido)",
  });
}

if (peakEnergy / totalEnergy < 0.12) {
  markers.push({
    index: findPeakIndex(actualCurve, "legs"),
    component: "legs",
    label: "Falta de pico de potencia",
  });
}

  function renderHandleGraph() {
    const width = 640;
    const height = 180;
    const current = graphHandlePath || [];
    const best = bestStrokeRef.current ? buildHandlePath(bestStrokeRef.current, 60) : [];

    const pathFor = (arr) => {
      if (!arr.length) return "";
      return arr
        .map((p, i) => {
          const x = p.x * width;
          const y = p.y * height;
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    };

    const currentPath = pathFor(current);
    const bestPath = pathFor(best);

    return (
      <svg width={width} height={height} className="w-full rounded-2xl bg-[#0E2238]">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={`vg-${p}`}
            x1={p * width}
            x2={p * width}
            y1={0}
            y2={height}
            stroke="#ffffff12"
          />
        ))}
        {[0, 0.33, 0.66, 1].map((p) => (
          <line
            key={`hg-${p}`}
            x1={0}
            x2={width}
            y1={p * height}
            y2={p * height}
            stroke="#ffffff10"
          />
        ))}

        {bestPath && (
          <path
            d={bestPath}
            stroke="rgba(0,255,255,0.45)"
            fill="none"
            strokeWidth="2"
            strokeDasharray="7 6"
          />
        )}

        {currentPath && (
          <path
            d={currentPath}
            stroke="#FFD700"
            fill="none"
            strokeWidth="3"
          />
        )}

        {current.length > 1 && (
          <circle
            cx={current[Math.min(current.length - 1, Math.floor(current.length * ghostPhase))].x * width}
            cy={current[Math.min(current.length - 1, Math.floor(current.length * ghostPhase))].y * height}
            r="5.5"
            fill="#FFD700"
  <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
</circle>
          />
        )}
      </svg>
    );
  }

  function renderProgressGraph() {
    const data = user.sessions || [];
    const width = 640;
    const height = 160;
    const maxScore = Math.max(100, ...data.map((d) => d.score || 0));

    const path = data
      .map((d, i) => {
        const x = (i / Math.max(1, data.length - 1)) * width;
        const y = height - ((d.score || 0) / maxScore) * (height * 0.85);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="w-full rounded-2xl bg-[#0E2238]">
        <line x1={0} x2={width} y1={height - 20} y2={height - 20} stroke="#ffffff18" />
        <line x1={0} x2={width} y1={20} y2={20} stroke="#ffffff10" />
        {path && <path d={path} stroke="#FFD700" fill="none" strokeWidth="3" />}
        {data.map((d, i) => {
          const x = (i / Math.max(1, data.length - 1)) * width;
          const y = height - ((d.score || 0) / maxScore) * (height * 0.85);
          return <circle key={`s-${i}`} cx={x} cy={y} r="2.5" fill="#FFD700" />;
        })}
      </svg>
    );
  }

  const sessionsCount = user.sessions?.length || 0;
  const avgScore =
    sessionsCount > 0
      ? Math.round(user.sessions.reduce((a, b) => a + (b.score || 0), 0) / sessionsCount)
      : 0;

  const avgPower =
    sessionsCount > 0
      ? Math.round(user.sessions.reduce((a, b) => a + (b.powerScore || 0), 0) / sessionsCount)
      : 0;

  return (
    <div className="min-h-screen grid grid-cols-[280px_1fr] bg-[#0B1A2B] text-white">
       <img
  src="/logo.png"
  alt="RowXia"
  className="absolute top-4 right-6 w-16 opacity-90 z-50"
/>
      {/* Sidebar */}
      <aside className="border-r border-white/10 bg-black/35 p-5">
       <div className="flex items-center gap-3">
  <img src="/logo.png" alt="logo" className="w-10 h-10" />
  <div className="flex items-center gap-3">
  <img
    src="/logo.png"
    alt="RowXia logo"
    className="w-10 h-10 object-contain"
  />

  <span className="text-2xl font-bold tracking-wide text-yellow-400">
    ROWXIA
  </span>
</div>
        <p className="mt-1 text-xs text-white/50">Olympic analysis build</p>

        <div className="mt-5">
          <label className="mb-2 block text-sm text-white/70">Técnica</label>
          <select
            className="w-full rounded-lg bg-white px-3 py-2 text-black outline-none"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="rowerg">RowErg</option>
            <option value="rp3">RP3</option>
            <option value="banco_movil">Banco móvil</option>
            <option value="banco_fijo">Banco fijo</option>
            <option value="coastal">Coastal rowing</option>
          </select>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-[#132B45] p-3">
            <p className="text-white/55">Score</p>
            <p className="text-xl font-semibold text-yellow-400">{score}</p>
          </div>
          <div className="rounded-2xl bg-[#132B45] p-3">
            <p className="text-white/55">Best</p>
            <p className="text-xl font-semibold text-cyan-300">{bestScore}</p>
          </div>
          <div className="rounded-2xl bg-[#132B45] p-3">
            <p className="text-white/55">SPM</p>
            <p className="text-xl font-semibold">{spm}</p>
          </div>
          <div className="rounded-2xl bg-[#132B45] p-3">
            <p className="text-white/55">Phase</p>
            <p className="text-xl font-semibold">{phase}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <div className="rounded-xl bg-[#132B45] p-3">
            Timing: <span className="text-yellow-400">{timingScore}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Potencia: <span className="text-yellow-400">{powerValue}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Ratio: <span className="text-yellow-400">{ratioValue.toFixed(2)}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Elite gap: <span className="text-yellow-400">{eliteGap.toFixed(1)}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Consistency: <span className="text-yellow-400">{consistencyScore}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Fatiga: <span className="text-yellow-400">{fatigueValue}</span>
          </div>
          <div className="rounded-xl bg-[#132B45] p-3">
            Prediction: <span className="text-yellow-400">{predictionValue}</span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-[#132B45] p-4">
          <p className="text-sm font-medium text-yellow-400">Feedback</p>
          <div className="mt-2 space-y-1 text-sm text-white/85">
            {feedback.length ? (
              feedback.map((f, i) => (
                <p key={i} className="leading-snug">
                  {f}
                </p>
              ))
            ) : (
              <p className="text-white/45">Sin feedback aún.</p>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-[#132B45] p-4 text-sm">
          <p className="text-yellow-400">Progreso atleta</p>
          <p className="mt-2">Sesiones: {sessionsCount}</p>
          <p>Score medio: {avgScore}</p>
          <p>Potencia media: {avgPower}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col items-center gap-5 p-6">
        {!videoSrc ? (
          <label className="rounded-2xl border border-dashed border-white/25 bg-[#132B45] px-6 py-10 text-center">
            <p className="text-lg font-medium text-white">Sube un vídeo lateral</p>
            <p className="mt-2 text-sm text-white/55">
              Recomendado: vídeo estable, lateral, buena luz.
            </p>
            <input
              type="file"
              accept="video/*"
              onChange={handleUpload}
              className="mt-4 block w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-yellow-300"
            />
          </label>
        ) : (
          <>
            <div className="w-full max-w-5xl">
              <canvas ref={canvasRef} className="w-full rounded-2xl bg-black shadow-2xl" />
              <video ref={videoRef} src={videoSrc} className="hidden" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={togglePlay}
                className="rounded-xl bg-yellow-400 px-5 py-2 font-semibold text-black"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>

              <button
                onClick={stepFrame}
                className="rounded-xl bg-white px-5 py-2 font-semibold text-black"
              >
                Step
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(user, null, 2)], {
                    type: "application/json",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "rowxia_data.json";
                  a.click();
                }}
                className="rounded-xl bg-emerald-400 px-5 py-2 font-semibold text-black"
              >
                Exportar datos
              </button>
            </div>

            <div className="w-full max-w-5xl space-y-5">
              <section className="rounded-2xl bg-[#132B45] p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Señal de secuenciación</h2>
                  <span className="text-sm text-white/55">Velocidad de piernas / espalda / brazos</span>
                </div>
                {renderVelocityGraph()}
              </section>

              <section className="rounded-2xl bg-[#132B45] p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Recorrido del handle</h2>
                  <span className="text-sm text-white/55">Curva actual + ghost stroke</span>
                </div>
                {renderHandleGraph()}
              </section>

              <section className="rounded-2xl bg-[#132B45] p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Progreso</h2>
                  <span className="text-sm text-white/55">Score por stroke / sesión</span>
                </div>
                {renderProgressGraph()}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
