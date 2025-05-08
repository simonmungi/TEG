// src/components/GameControls.jsx
import React, { useState, useEffect } from 'react';
import './GameControls.css';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

function GameControls({
    gamePhase,
    selectedTerritory,
    targetTerritory,
    currentPlayerId,
    gamePlayerId,
    availableReinforcements,
    onReinforce,
    onAttack,
    onFortify,
    onEndTurn,
    remainingToPlaceInUI,       // Cuántos quedan por colocar según la UI
    placedOnSelectedTerritory,  // Cuántos se han añadido al terr. selecc. en la UI
    onUiIncrementPlacement,     // Handler para el botón '+'
    onUiDecrementPlacement,     // Handler para el botón '-'
    onConfirmAllReinforcements, // Handler para el botón "Confirmar Refuerzos"
    onCancel
}) {
    const [armiesToAdd, setArmiesToAdd] = useState(1);
    const [armyCount, setArmyCount] = useState(1); // Para inputs de cantidad
    const isMyTurn = currentPlayerId === gamePlayerId;

    useEffect(() => {
        setArmyCount(1);
    }, [selectedTerritory, targetTerritory, gamePhase]);

    useEffect(() => {
        setArmiesToAdd(1);
    }, [selectedTerritory, gamePhase]);

    if (!isMyTurn) {
        return <div className="game-controls">Esperando turno de otro jugador...</div>;
    }

    const handleDecrement = () => {
        setArmiesToAdd(prev => Math.max(1, prev - 1)); // No bajar de 1
    };

    const handleIncrement = () => {
        setArmiesToAdd(prev => Math.min(availableReinforcements, prev + 1));
    };

    const handleConfirmReinforce = () => {
        if (armiesToAdd > 0 && selectedTerritory) {
            onReinforce(armiesToAdd);
        }
    };

    const renderReinforceControls = () => {
        if (gamePhase !== 'Reinforcement' || !selectedTerritory || selectedTerritory.ownerPlayerId !== gamePlayerId) {
            return gamePhase === 'Reinforcement' ? <p>Selecciona un territorio propio para reforzar.</p> : null;
        }

        const displayArmiesInTerritory = selectedTerritory.armies + (placedOnSelectedTerritory || 0);

        return (
            <div className="reinforce-controls">
                <h4>Reforzar: {selectedTerritory.name}</h4>
                <p>Ejércitos en territorio: {displayArmiesInTerritory} ({selectedTerritory.armies} base + {placedOnSelectedTerritory || 0} añadidos)</p>
                <div className="army-selector">
                    <button
                        onClick={() => onUiDecrementPlacement(selectedTerritory.id)}
                        disabled={(placedOnSelectedTerritory || 0) <= 0}
                    >
                        -
                    </button>
                    <span className="army-count" title="Refuerzos que te quedan por colocar en este turno">
                        {remainingToPlaceInUI}
                    </span>
                    <button
                        onClick={() => onUiIncrementPlacement(selectedTerritory.id)}
                        disabled={remainingToPlaceInUI <= 0}
                    >
                        +
                    </button>
                </div>
                <div className="reinforce-actions">
                    <button
                        onClick={onConfirmAllReinforcements}
                        disabled={remainingToPlaceInUI > 0} // Habilitado solo si ya se colocaron todos
                        className="confirm-button"
                    >
                        Confirmar Refuerzos
                    </button>
                    <button onClick={onCancel} className="cancel-button">Deseleccionar</button>
                </div>
            </div>
        );
    };

    const renderAttackControls = () => {
        if (gamePhase !== 'Attack' || !selectedTerritory || !targetTerritory) return null;
        const maxAttackers = selectedTerritory.armies - 1;
        if (maxAttackers <= 0) return <p>No tienes suficientes ejércitos para atacar desde {selectedTerritory.name}.</p>;

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
            {gamePhase === 'Fortification' && (!selectedTerritory || !targetTerritory) && <button onClick={onEndTurn}>Terminar Turno</button>}
            {/* Podrías tener botones explícitos para cambiar de fase */}

        </div>

    );
}
// Añade estilos básicos en GameControls.css
export default GameControls;