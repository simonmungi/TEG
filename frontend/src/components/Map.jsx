// src/components/Map.jsx
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Path, Text, Rect, Group, Circle } from 'react-konva';
import './Map.css';

const getPlayerColor = (playerId, players) => {
  const player = players.find(p => p.id === playerId);
  return player ? player.color : '#CCCCCC';
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
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1.3);

  const mapBounds = useMemo(() => {
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
  }, []);

  useEffect(() => {
    const checkSizeAndSetView = () => {
      if (containerRef.current && mapBounds.width > 0 && mapBounds.height > 0) {
        const newWidth = containerRef.current.offsetWidth;
        const newHeight = containerRef.current.offsetHeight;
        setStageSize({ width: newWidth, height: newHeight });

        const scaleX = newWidth / mapBounds.width;
        const scaleY = newHeight / mapBounds.height;
        const initialScale = Math.min(scaleX, scaleY);
        setStageScale(initialScale);

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

  const handleWheel = (e) => {
    e.evt.preventDefault(); // Prevenir scroll de la página

    const scaleBy = 1.1;
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
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // Aplicar límites de zoom
    const minScale = 1.3;
    const maxScale = 5.0;

    let newScale;
    if (direction > 0) {
      newScale = oldScale * scaleBy;
    } else {
      newScale = oldScale / scaleBy;
    }

    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    if (newScale === oldScale) {
      return;
    }
    setStageScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStagePos(newPos);
  };

  const calculateCenter = (territory) => {
    // Extrae todos los números (positivos y negativos, enteros o decimales) del string.
    const regex = /-?\d+\.?\d*/g;
    const matches = territory.pathData.match(regex);

    // Verifica que se encontraron al menos dos números (x e y).
    if (!matches || matches.length < 2) {
      return { x: 0, y: 0 };
    }

    // Convierte la lista de números (en formato string) a números y agrúpalos en puntos.
    const points = [];
    for (let i = 0; i < matches.length; i += 2) {
      const x = parseFloat(matches[i]);
      const y = parseFloat(matches[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }

    // Calcula la media aritmética de las coordenadas para obtener el centro.
    const center = points.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );

    center.x /= points.length;
    center.y /= points.length;

    return center;
  };


  const armyCounterRadius = 12;
  const armyFontSize = 10;
  const nameFontSize = 10; 
  const labelPadding = 3;

  const displayTerritories = territories && Object.keys(territories).length > 0 ? territories : placeholderTerritories;
  const territoriesArray = Array.isArray(displayTerritories) ? displayTerritories : Object.values(displayTerritories);
  return (
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

            let center = calculateCenter(territory);

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
                  fill={territory.clickable ? ownerColor : 'grey'}
                  stroke={isSelected ? 'yellow' : (isTarget ? 'red' : 'black')}
                  strokeWidth={isSelected || isTarget ? 3 : 1}
                  opacity={0.9}
                  onClick={() => onTerritoryClick(territory.id)}
                  onTap={() => onTerritoryClick(territory.id)}
                  onMouseEnter={e => {
                    if (!territory.clickable) return;
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'pointer';
                    e.target.opacity(1);
                    e.target.fill('red');
                  }}
                  onMouseLeave={e => {
                    if (!territory.clickable) return;
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'default';
                    e.target.opacity(0.9);
                    e.target.fill(ownerColor);

                  }}
                />
                {/* --- Grupo para el Contador de Ejércitos --- */}
                {territory.clickable && <Group
                  x={center.x}
                  y={center.y}
                  listening={false}
                >
                  {/* Círculo de fondo */}
                  <Circle
                    radius={armyCounterRadius / stageScale}
                    fill={"black"}
                    opacity={1}
                    stroke="#FFF"
                    strokeWidth={1 / stageScale}
                  />

                  {/* Texto con el número de ejércitos */}
                  <Text
                    text={territory.armies.toString()}
                    fontSize={armyFontSize / stageScale} // Ajusta tamaño de fuente con zoom
                    fill="white"
                    align="center"
                    verticalAlign="middle"

                    x={-armyCounterRadius / stageScale}
                    y={-armyCounterRadius / stageScale} 
                    width={armyCounterRadius * 2 / stageScale} 
                    height={armyCounterRadius * 2 / stageScale} 
                  />

                  {/* <Text
                    text={territory.name} 
                    fontSize={nameFontSize / stageScale}
                    fill="black"
                    align="center"
                    y={(armyCounterRadius / stageScale) + (labelPadding / stageScale)}
                    width={territory.name.length * (nameFontSize / stageScale) * 0.6}
                    offsetX={(territory.name.length * (nameFontSize / stageScale) * 0.6) / 2}
                  /> */}
                </Group>}
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

export default Map;