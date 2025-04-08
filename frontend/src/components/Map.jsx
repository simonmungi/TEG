// src/components/Map.jsx
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Path, Text, Label, Tag } from 'react-konva';
import './Map.css';

// Función auxiliar para obtener color (o definirlo en App.jsx y pasarlo)
const getPlayerColor = (playerId, players) => {
  const player = players.find(p => p.id === playerId);
  return player ? player.color : '#CCCCCC'; // Gris por defecto (neutral)
};

function Map({
  territories = [],
  players = [],
  onTerritoryClick,
  selectedTerritoryId,
  targetTerritoryId
}) {
  const containerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 1024, height: 800 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 }); // Estado para posición del Stage
  const [stageScale, setStageScale] = useState(1);       // Estado para escala del Stage

  const mapBounds = useMemo(() => {
      // Idealmente, calcula esto a partir de 'territories'
      const minX = 20;
      const minY = 30;
      const maxX = stageSize.width;
      const maxY = stageSize.height;
      return {
          minX: minX,
          minY: minY,
          width: maxX - minX,
          height: maxY - minY,
      };
  }, []); // Recalcular solo si 'territories' cambiara (si lo pones como dependencia)

  useEffect(() => {
    const checkSizeAndSetView = () => {
      if (containerRef.current && mapBounds.width > 0 && mapBounds.height > 0) {
        const newWidth = containerRef.current.offsetWidth;
        const newHeight = containerRef.current.offsetHeight;
        setStageSize({ width: newWidth, height: newHeight });

        // Calcular escala inicial para ajustar el mapa al contenedor
        const scaleX = newWidth / mapBounds.width;
        const scaleY = newHeight / mapBounds.height;
       // const initialScale = Math.min(scaleX, scaleY) * 0.95; // Ajustar para un pequeño margen (0.95)
        const initialScale = Math.min(scaleX, scaleY); // Ajustar para un pequeño margen (0.95)
        setStageScale(initialScale);

        // Calcular posición para centrar el mapa escalado
        const initialX = (newWidth - mapBounds.width * initialScale) / 2 - mapBounds.minX * initialScale;
        const initialY = (newHeight - mapBounds.height * initialScale) / 2 - mapBounds.minY * initialScale;
        setStagePos({ x: initialX, y: initialY });

        console.log("Initial View Set:", { initialScale, initialX, initialY });
      }
    }

    checkSizeAndSetView();
    window.addEventListener('resize', checkSizeAndSetView);
    return () => window.removeEventListener('resize', checkSizeAndSetView);
  }, [mapBounds]);


  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    checkSize();

    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // --- Manejador de Zoom (Rueda del Ratón) ---
  const handleWheel = (e) => {
    e.evt.preventDefault(); // Prevenir scroll de la página

    const scaleBy = 1.1; // Factor de zoom
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return; // Salir si no hay posición del puntero

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Determinar nueva escala (zoom in o out)
    let direction = e.evt.deltaY > 0 ? -1 : 1; // -1 zoom out, 1 zoom in

    // Aplicar límites de zoom (opcional)
    const minScale = 1;
    const maxScale = 5.0;

    let newScale;
    if (direction > 0) { // Zoom In
      newScale = oldScale * scaleBy;
    } else { // Zoom Out
      newScale = oldScale / scaleBy;
    }

    // Aplicar límites
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    // Si la escala no cambió (por los límites), no hacer nada más
    if (newScale === oldScale) {
      return;
    }
    setStageScale(newScale);

    // Calcular nueva posición para que el punto bajo el ratón se mantenga
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);
  };

  const displayTerritories = territories && Object.keys(territories).length > 0 ? territories : placeholderTerritories;
  const territoriesArray = Array.isArray(displayTerritories) ? displayTerritories : Object.values(displayTerritories);
  return (
    // Contenedor para medir el tamaño disponible
    <div ref={containerRef} style={{ width: '100%', height: '100%', border: '1px solid red', position: 'relative' }}>
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={true}

      >
        <Layer>

          {territoriesArray.map((territory) => {
            if (!territory.pathData) {
              console.warn(`Territorio ${territory.id} no tiene pathData.`);
              return null;
            }

            const isSelected = territory.id === selectedTerritoryId;
            const isTarget = territory.id === targetTerritoryId;
            const ownerColor = getPlayerColor(territory.ownerPlayerId, players);

            return (
              <React.Fragment key={territory.id}>
                {/* Dibuja la forma del territorio */}
                <Path
                  data={territory.pathData}
                  fill={ownerColor}
                  stroke={isSelected ? 'yellow' : (isTarget ? 'red' : 'black')} // Borde según selección/target
                  strokeWidth={isSelected || isTarget ? 3 : 1}
                  opacity={0.9}
                  // shadowColor="black"
                  // shadowBlur={isSelected || isTarget ? 10 : 3}
                  // shadowOpacity={0.5}
                  onClick={() => onTerritoryClick(territory.id)} // Evento de clic
                  onTap={() => onTerritoryClick(territory.id)} // Para móvil
                  onMouseEnter={e => {
                    // Cambiar cursor y opcionalmente resaltar
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'pointer';
                    e.target.opacity(1); // Resaltar al pasar el mouse
                    // Podrías también usar onMouseOver/onMouseOut para mostrar un tooltip
                  }}
                  onMouseLeave={e => {
                    // Restaurar cursor y opacidad
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'default';
                    e.target.opacity(0.9);
                  }}
                />
                {/* Dibuja el número de ejércitos */}
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

export default Map;