// src/components/GameIdModal.jsx
import React, { useState } from 'react';
import './GameIdModal.css'; // Crearemos este archivo CSS

function GameIdModal({ isOpen, onSubmit }) {
  const [enteredId, setEnteredId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault(); // Evita que el form recargue la página
    // Validación simple (puedes hacerla más robusta, ej: regex para GUID)
    if (!enteredId.trim()) {
      setError('Por favor, ingresa un ID de partida.');
      return;
    }
    // Validación básica de formato GUID (opcional pero recomendada)
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!guidRegex.test(enteredId.trim())) {
       setError('El formato del ID no parece un GUID válido (ej: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
       return;
    }

    setError(''); // Limpiar error si es válido
    onSubmit(enteredId.trim()); // Llama a la función onSubmit pasada por props
    setEnteredId(''); // Limpiar input después de enviar
  };

  if (!isOpen) {
    return null;
  }

  return (
    
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Ingresar ID de Partida Existente</h2>
        <form onSubmit={handleSubmit}>
          <p>Pega el ID (GUID) de la partida a la que quieres unirte:</p>
          <input
            type="text"
            value={enteredId}
            onChange={(e) => setEnteredId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            aria-label="Game ID"
            required
          />
          {error && <p className="modal-error">{error}</p>}
          <button type="submit">Unirse a la Partida</button>
          {/* Podrías añadir un botón para "Crear Partida Nueva" aquí */}
        </form>
         {/* NOTA: Por ahora no hay botón para cerrar, el usuario DEBE ingresar un ID */}
      </div>
    </div>
  );
}

export default GameIdModal;