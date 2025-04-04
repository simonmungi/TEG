// src/components/GameInfo.jsx
import React from 'react';
import './GameInfo.css';

const phaseDisplayNames = {
    WaitingForPlayers: "Esperando Jugadores",
    Reinforcement: "Refuerzo",
    Attack: "Ataque",
    Fortification: "Fortificación",
    GameOver: "Partida Terminada"
};


function GameInfo({ players, currentPlayerId, currentPhase }) {
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const phaseName = phaseDisplayNames[currentPhase] || currentPhase;

    return (
        <div className="game-info">
             <h3>Información de la Partida</h3>
             <div className="info-item">
                 <strong>Turno de:</strong>
                 <span style={{ color: currentPlayer?.color || '#000', marginLeft: '5px', fontWeight: 'bold' }}>
                     {currentPlayer?.name || 'N/A'}
                 </span>
             </div>
             <div className="info-item">
                 <strong>Fase Actual:</strong> {phaseName}
             </div>
             <h4>Jugadores:</h4>
             <ul>
                 {players.map(p => (
                     <li key={p.id} style={{ color: p.color }}>
                        {p.name} {p.id === currentPlayerId ? ' (Turno Actual)' : ''}
                     </li>
                 ))}
             </ul>
        </div>
    );
}
 // Añade estilos básicos en GameInfo.css
export default GameInfo;