import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">🚀 Chat App</h1>
        <p className="text-xl mb-8">Microservices Architecture</p>

        <div className="mb-8">
          <button
            onClick={() => setCount((count) => count + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Count is {count}
          </button>
        </div>

        <div className="text-sm text-gray-400">
          <p>✅ React + TypeScript + Vite</p>
          <p>✅ Tailwind CSS</p>
          <p>✅ Hot Module Replacement</p>
        </div>
      </div>
    </div>
  );
}

export default App;
