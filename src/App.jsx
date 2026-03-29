import React, { useRef, useState, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [motionData, setMotionData] = useState([]);

  // =========================
  // LOAD VIDEO
  // =========================
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoFile(url);
  };

  // =========================
  // ANALYSIS LOOP (SIMULATED AI)
  // =========================
  const analyzeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");

    // draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // simulate motion tracking by sampling brightness changes
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    let motion = 0;

    for (let i = 0; i < data.length; i += 40) {
      motion += data[i]; // crude intensity sampling
    }

    setMotionData((prev) => [...prev.slice(-100), motion]);

    // simple heuristic feedback
    let msg = "Stable motion";

    if (motion > 5000000) msg = "High movement detected";
    if (motion < 2000000) msg = "Low movement / pause";

    setFeedback((prev) => [msg, ...prev.slice(0, 4)]);
  };

  // =========================
  // VIDEO LOOP
  // =========================
  useEffect(() => {
    let interval;

    if (playing) {
      interval = setInterval(() => {
        analyzeFrame();
      }, 100); // ~10 FPS analysis
    }

    return () => clearInterval(interval);
  }, [playing]);

  // =========================
  // DRAW MOTION GRAPH (LIKE YOUR ORIGINAL VISUAL STYLE)
  // =========================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const draw = () => {
      ctx.strokeStyle = "#00ffcc";
      ctx.lineWidth = 2;

      ctx.beginPath();

      motionData.forEach((m, i) => {
        const x = (i / motionData.length) * canvas.width;
        const y = canvas.height - (m % canvas.height);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    };

    draw();
  }, [motionData]);

  // =========================
  // CONTROLS
  // =========================
  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    video.play();
    setPlaying(true);
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setPlaying(false);
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>RowXia v5 AI Coach (No Dependencies)</h1>

      <input type="file" accept="video/*" onChange={handleVideoUpload} />

      {videoFile && (
        <div style={{ marginTop: 20 }}>
          <video
            ref={videoRef}
            src={videoFile}
            width="320"
            controls
            style={{ borderRadius: 12 }}
          />

          <div>
            <button onClick={handlePlay}>Play</button>
            <button onClick={handlePause}>Pause</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          style={{ border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Coach Feedback</h3>
        <ul>
          {feedback.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
