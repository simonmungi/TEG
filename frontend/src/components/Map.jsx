// src/components/Map.jsx
import React from 'react';
import './Map.css';

// Función auxiliar para obtener color (o definirlo en App.jsx y pasarlo)
const getPlayerColor = (playerId, players) => {
   const player = players.find(p => p.id === playerId);
   return player ? player.color : '#d5dbdb'; // Gris por defecto (neutral)
};

function Map({ territories, onTerritoryClick, selectedTerritoryId, targetTerritoryId, players }) {

  if (!territories || territories.length === 0) {
    return <div className="map-container">Cargando mapa...</div>;
  }

  return (
    
    <div className="map-container">
      <h2>Mapa del Juego</h2>
      <div className="territories">
        {territories.map((territory) => {
          const isSelected = territory.id === selectedTerritoryId;
          const isTarget = territory.id === targetTerritoryId;
          const ownerColor = getPlayerColor(territory.ownerPlayerId, players);

          // Construir clases CSS dinámicamente
          let territoryClasses = 'territory';
          if (isSelected) territoryClasses += ' selected';
          if (isTarget) territoryClasses += ' target';

          // Aplicar el color del jugador como estilo inline (o crear clases CSS)
          const territoryStyle = {
             backgroundColor: ownerColor,
             border: isSelected ? '3px solid yellow' : (isTarget ? '3px solid red' : `1px solid #555`),
          };

          return (
            <div
              key={territory.id}
              className={territoryClasses}
              style={territoryStyle}
              onClick={() => onTerritoryClick(territory.id)} // Llama al handler pasado por props
            >
              <span className="territory-name">{territory.name}</span>
              <span className="territory-armies">({territory.armies})</span>
            </div>
          );
          })}
      </div>
    </div>
  );
}

export default Map;