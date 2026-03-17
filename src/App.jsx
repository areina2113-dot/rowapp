import React, { useState } from "react";

export default function App() {
  const [userVideo, setUserVideo] = useState(null);
  const [referenceVideo, setReferenceVideo] = useState("");

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUserVideo(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-400 to-blue-600 text-white p-6">
      
      {/* HEADER */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold">RowXia</h1>
        <p className="text-xl mt-2">“Understand your stroke”</p>
      </div>

      {/* SUBIDA DE VIDEO */}
      <div className="bg-white text-gray-800 rounded-xl p-6 max-w-3xl mx-auto shadow-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Sube tu vídeo</h2>
        <input type="file" accept="video/*" onChange={handleUpload} />
      </div>

      {/* SELECTOR DE VIDEO DE REFERENCIA */}
      <div className="bg-white text-gray-800 rounded-xl p-6 max-w-3xl mx-auto shadow-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Vídeo de referencia</h2>
        <select
          className="w-full p-2 border rounded"
          onChange={(e) => setReferenceVideo(e.target.value)}
        >
          <option value="">Selecciona un vídeo</option>
          <option value="/videos/concept2.mp4">Concept2 Técnica</option>
          <option value="/videos/remo_espanol.mp4">Remo Español Técnica</option>
        </select>
      </div>

      {/* COMPARADOR */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        
        {/* VIDEO USUARIO */}
        <div className="bg-white rounded-xl p-4 text-black">
          <h3 className="font-semibold mb-2">Tu vídeo</h3>
          {userVideo ? (
            <video src={userVideo} controls className="w-full rounded" />
          ) : (
            <p>No has subido ningún vídeo</p>
          )}
        </div>

        {/* VIDEO REFERENCIA */}
        <div className="bg-white rounded-xl p-4 text-black">
          <h3 className="font-semibold mb-2">Referencia</h3>
          {referenceVideo ? (
            <video src={referenceVideo} controls className="w-full rounded" />
          ) : (
            <p>Selecciona un vídeo de referencia</p>
          )}
        </div>

      </div>
    </div>
  );
}
