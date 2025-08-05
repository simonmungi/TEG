// src/components/GameInfo.jsx
import React from 'react';
import './GameInfo.css';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

const phaseDisplayNames = {
    WaitingForPlayers: "ESPERANDO JUGADORES",
    Reinforcement: "REFUERZO",
    Attack: "ATAQUE",
    Fortification: "FORTIFICACIÓN",
    GameOver: "PARTIDA TERMINADA"
};

function GameInfo({ players, currentPlayerId, currentPhase }) {
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const phaseName = phaseDisplayNames[currentPhase] || currentPhase;

    return (

        <div className="game-info">            
            <div className="info-item phase-item">
                <span style={{  fontWeight: '600', fontSize: '1.5rem' }}>{phaseName}</span>
            </div>
            
            <div className="players-section">
                <ul className="players-list">
                    {players.map(p => (
                        <li key={p.id} className={`player-item ${p.id === currentPlayerId ? 'current-player' : ''}`} style={{ backgroundColor: p.color }}>
                            <div className="player-name">
                                <span style={{ color: '#1a1a2e' }}>{p.name}</span>
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