import React from "react";
import './Map.css';

const territoriesData = [
    { id: 'arg', name: 'Argentina', owner: 'Player 1', armies: 5 },
    { id: 'bra', name: 'Brasil', owner: 'Player 2', armies: 3 },
    { id: 'chi', name: 'Chile', owner: 'Player 1', armies: 2 },
    { id: 'per', name: 'Peru', owner: null, armies: 1 },
];

function Map() {
    return (
        <div className="map-container">
            <h2>Mapa del juego</h2>
            <div className="territories">
                {territoriesData.map((territory) => (
                    <div
                        key={territory.id}
                        className={`territory territory-owner-${territory.owner?.replace(' ', '-') || 'neutral'}`}
                    >
                        <span className="territory-name">{territory.name}</span>
                        <span className="territory-armies">({territory.armies})</span>
                    </div>
                ))}
            </div>
        </div>

    );
}

export default Map;