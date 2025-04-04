// src/components/GameControls.jsx
import React, { useState, useEffect } from 'react';
import './GameControls.css';

function GameControls({
    gamePhase,
    selectedTerritory,
    targetTerritory,
    currentPlayerId, // Quién SOY YO (temporalmente hardcodeado en App.jsx)
    gamePlayerId,  // De quién ES el turno según el juego
    onReinforce,
    onAttack,
    onFortify,
    onEndTurn,
    onCancel
 }) {
    const [armyCount, setArmyCount] = useState(1); // Para inputs de cantidad
    const isMyTurn = currentPlayerId === gamePlayerId;

    // Resetear armyCount cuando cambien las selecciones o fase
    useEffect(() => {
        setArmyCount(1);
    }, [selectedTerritory, targetTerritory, gamePhase]);


    if (!isMyTurn) {
        return <div className="game-controls">Esperando turno de otro jugador...</div>;
    }

    const renderReinforceControls = () => {
        if (gamePhase !== 'Reinforcement' || !selectedTerritory) return null;
         // TODO: Validar cuántos refuerzos tiene realmente el jugador
        return (
            <div>
                <h4>Reforzar {selectedTerritory.name}</h4>
                <input
                    type="number"
                    value={armyCount}
                    onChange={(e) => setArmyCount(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    // max={availableReinforcements} // Añadir cuando se calcule
                />
                <button onClick={() => onReinforce(armyCount)} disabled={armyCount <= 0}>Reforzar</button>
                <button onClick={onCancel}>Cancelar</button>
            </div>
        );
    };

    const renderAttackControls = () => {
        if (gamePhase !== 'Attack' || !selectedTerritory || !targetTerritory) return null;
        const maxAttackers = selectedTerritory.armies - 1;
        if (maxAttackers <= 0) return <p>No tienes suficientes ejércitos para atacar desde {selectedTerritory.name}.</p>;

         // Ajustar el valor si excede el máximo permitido
         const currentArmyCount = Math.min(armyCount, maxAttackers);


        return (
            <div>
                <h4>Atacar {targetTerritory.name} desde {selectedTerritory.name}</h4>
                 <label>Ejércitos a usar (máx: {maxAttackers}): </label>
                <input
                    type="number"
                    value={currentArmyCount}
                    onChange={(e) => setArmyCount(Math.max(1, Math.min(maxAttackers, parseInt(e.target.value) || 1)))}
                    min="1"
                    max={maxAttackers}
                />
                <button onClick={() => onAttack(currentArmyCount)} disabled={currentArmyCount <= 0}>¡Atacar!</button>
                 <button onClick={onCancel}>Cancelar</button>
            </div>
        );
    };

     const renderFortifyControls = () => {
         if (gamePhase !== 'Fortification' || !selectedTerritory || !targetTerritory) return null;
         const maxToMove = selectedTerritory.armies - 1;
          if (maxToMove <= 0) return <p>No tienes suficientes ejércitos para mover desde {selectedTerritory.name}.</p>;

         // Ajustar el valor si excede el máximo permitido
         const currentArmyCount = Math.min(armyCount, maxToMove);


         return (
             <div>
                 <h4>Fortificar: Mover de {selectedTerritory.name} a {targetTerritory.name}</h4>
                 <label>Ejércitos a mover (máx: {maxToMove}): </label>
                 <input
                     type="number"
                     value={currentArmyCount}
                     onChange={(e) => setArmyCount(Math.max(1, Math.min(maxToMove, parseInt(e.target.value) || 1)))}
                     min="1"
                     max={maxToMove}
                 />
                 <button onClick={() => onFortify(currentArmyCount)} disabled={currentArmyCount <= 0}>Mover Ejércitos</button>
                  <button onClick={onCancel}>Cancelar</button>
             </div>
         );
     };


    return (
        <div className="game-controls">
            <h3>Acciones</h3>
            {renderReinforceControls()}
            {renderAttackControls()}
            {renderFortifyControls()}

            {/* Botón para terminar fase/turno */}
            {gamePhase === 'Attack' && (!selectedTerritory || !targetTerritory) && <button onClick={onEndTurn}>Terminar Fase de Ataque</button>}
            {gamePhase === 'Fortification' && (!selectedTerritory || !targetTerritory) &&<button onClick={onEndTurn}>Terminar Turno</button>}
            {/* Podrías tener botones explícitos para cambiar de fase */}

        </div>
    );
}
// Añade estilos básicos en GameControls.css
export default GameControls;