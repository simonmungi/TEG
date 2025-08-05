// src/components/GameControls.jsx
import React, { useState, useEffect } from 'react';
import './GameControls.css';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';

function GameControls({
    gamePhase,
    selectedTerritory,
    targetTerritory,
    currentPlayerId,
    localPlayerId,
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
    onCancel,
    open,                       // Control modal visibility
    onClose                     // Close modal handler
}) {
    const [armiesToAdd, setArmiesToAdd] = useState(1);
    const [armyCount, setArmyCount] = useState(1); // Para inputs de cantidad
    const isMyTurn = currentPlayerId === localPlayerId;

    useEffect(() => {
        setArmyCount(1);
    }, [selectedTerritory, targetTerritory, gamePhase]);

    useEffect(() => {
        setArmiesToAdd(1);
    }, [selectedTerritory, gamePhase]);

    if (!isMyTurn) {
        return (
            <Dialog 
                open={open} 
                onClose={onClose}
                maxWidth="sm" 
                fullWidth
                PaperProps={{
                    sx: {
                        background: 'transparent',
                        boxShadow: 'none',
                        overflow: 'visible'
                    }
                }}
            >
                <div className="reinforce-controls">
                    Esperando turno de otro jugador...
                </div>
            </Dialog>
        );
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
        if (gamePhase !== 'Reinforcement' || !selectedTerritory || selectedTerritory.ownerPlayerId !== localPlayerId) {
            return gamePhase === 'Reinforcement' ? <p>Selecciona un territorio propio para reforzar.</p> : null;
        }

        const displayArmiesInTerritory = selectedTerritory.armies + (placedOnSelectedTerritory || 0);

        return (
            <div className="reinforce-controls">
                <h4>Reforzar: {selectedTerritory.name}</h4>
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
            <div className="reinforce-controls">
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
            <div className="reinforce-controls">
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

    const renderEndTurnButtons = () => {
        if (gamePhase === 'Attack' && (!selectedTerritory || !targetTerritory)) {
            return (
                <div className="reinforce-controls">
                    <Button onClick={onEndTurn} variant="contained" fullWidth>Terminar Fase de Ataque</Button>
                </div>
            );
        }
        if (gamePhase === 'Fortification' && (!selectedTerritory || !targetTerritory)) {
            return (
                <div className="reinforce-controls">
                    <Button onClick={onEndTurn} variant="contained" fullWidth>Terminar Turno</Button>
                </div>
            );
        }
        return null;
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{
                sx: {
                    background: 'transparent',
                    boxShadow: 'none',
                    overflow: 'visible'
                }
            }}
        >
            {renderReinforceControls()}
            {renderAttackControls()}
            {renderFortifyControls()}
            {renderEndTurnButtons()}
        </Dialog>
    );
}

export default GameControls;