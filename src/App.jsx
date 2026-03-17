import React from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-400 to-blue-600 text-white p-6">
      <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center">
        RowXia
      </h1>
      <p className="text-xl md:text-2xl mb-8 text-center">
        “Understand your stroke”
      </p>

      <div className="bg-white text-gray-800 rounded-xl shadow-lg p-8 max-w-xl w-full space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Análisis inteligente</h2>
          <p>Usa IA para interpretar tus datos de remo y ofrecer información precisa sobre tu técnica.</p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2">Corrección y optimización</h2>
          <p>Recibe alertas sobre errores técnicos y consejos prácticos para mejorar cada palada.</p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2">Rendimiento máximo</h2>
          <p>Ayuda a maximizar la eficiencia de cada remada y hacer que tu entrenamiento sea más efectivo.</p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2">Para todos los niveles</h2>
          <p>Diseñado para remeros principiantes, avanzados, entrenadores y equipos completos.</p>
        </div>
      </div>
    </div>
  );
}
