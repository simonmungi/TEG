// src/components/GameInfo.jsx
import React from 'react';
import './GameInfo.css';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

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
                <strong>Fase Actual:</strong> 
                <span style={{ color: '#81c784', fontWeight: '600' }}>{phaseName}</span>
            </div>
            
            <div className="players-section">
                <ul className="players-list">
                    {players.map(p => (
                        <li key={p.id} className={`player-item ${p.id === currentPlayerId ? 'current-player' : ''}`}>
                            <div className="player-name">
                                <div 
                                    className="color-indicator" 
                                    style={{ backgroundColor: p.color }}
                                ></div>
                                <span style={{ color: p.color }}>{p.name}</span>
                                {p.id === currentPlayerId && (
                                    <span className="current-player-badge">Turno Actual</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
// Añade estilos básicos en GameInfo.css
export default GameInfo;