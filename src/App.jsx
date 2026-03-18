import React, { useRef, useState, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoSrc, setVideoSrc] = useState(null);

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
        results.poseLandmarks.forEach((point) => {
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
    </div>
  );
}
