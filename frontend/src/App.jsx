// src/App.jsx
import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import GameControls from './components/GameControls';
import GameInfo from './components/GameInfo';
import GameIdModal from './components/GameIdModal';
import './App.css';
import { useGameActions } from './hooks/useGameHandlers';
import { useSignalR } from './hooks/useSignalR';
import { useGameData } from './hooks/useGameData';

// Constants
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5011';
const INITIAL_UI_REINFORCEMENTS = {
  initialTotalForTurn: 0,
  remainingToPlaceInUI: 0,
  placements: {}
};

function App() {
  // Game ID state
  const [gameId, setGameId] = useState(null);

  // UI state
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [targetTerritoryId, setTargetTerritoryId] = useState(null);
  const [uiReinforcements, setUiReinforcements] = useState(INITIAL_UI_REINFORCEMENTS);
  const [gameControlsOpen, setGameControlsOpen] = useState(false);

  // Custom hooks
  const { game, setGame, isLoading, error, setError, myPlayerId, setMyPlayerId } = useGameData(gameId, API_BASE_URL);

  const handleGameStateUpdate = (updatedGame) => {
    setGame(updatedGame);
    setSelectedTerritoryId(null);
    setTargetTerritoryId(null);
  };

  const connection = useSignalR(gameId, API_BASE_URL, handleGameStateUpdate);

  const {
    handleTerritoryClick,
    handleUiIncrementPlacement,
    handleUiDecrementPlacement,
    handleConfirmAllReinforcements,
    handleEndTurn,
    handleAttack,
    handleFortify
  } = useGameActions({
    game, setGame,
    gameId,
    myPlayerId,
    uiReinforcements, setUiReinforcements,
    selectedTerritoryId, setSelectedTerritoryId,
    targetTerritoryId, setTargetTerritoryId,
    setError,
    API_BASE_URL,
    setGameControlsOpen
  });

  // UI Reinforcements management
  const shouldResetUIReinforcements = (game, myPlayerId, uiReinforcements) => {
    if (!game || game.currentPhase !== 'Reinforcement' || game.currentPlayerId !== myPlayerId) {
      return Object.keys(uiReinforcements.placements).length > 0 ||
        uiReinforcements.remainingToPlaceInUI !== 0 ||
        uiReinforcements.initialTotalForTurn !== 0;
    }
    return false;
  };

  const shouldInitializeUIReinforcements = (game, myPlayerId, uiReinforcements) => {
    if (!game || game.currentPhase !== 'Reinforcement' || game.currentPlayerId !== myPlayerId) {
      return false;
    }

    return (uiReinforcements.initialTotalForTurn === 0 && game.pendingReinforcements > 0) ||
      (game.pendingReinforcements !== uiReinforcements.remainingToPlaceInUI && Object.keys(uiReinforcements.placements).length === 0) ||
      (uiReinforcements.initialTotalForTurn > 0 && game.pendingReinforcements > uiReinforcements.remainingToPlaceInUI);
  };

  useEffect(() => {
    if (!game) return;

    // TODO: ELIMINAR - temporary assignment
    setMyPlayerId(game.currentPlayerId);
    console.log(`Asumiendo ser el jugador: (ID: ${game.currentPlayerId})`);

    if (shouldResetUIReinforcements(game, myPlayerId, uiReinforcements)) {
      console.log("[UI Reinforcement] Not in our Reinforcement phase. Clearing UI state. Current Phase:", game.currentPhase);
      setUiReinforcements(INITIAL_UI_REINFORCEMENTS);
    } else if (shouldInitializeUIReinforcements(game, myPlayerId, uiReinforcements)) {
      setUiReinforcements({
        initialTotalForTurn: game.pendingReinforcements,
        remainingToPlaceInUI: game.pendingReinforcements,
        placements: {}
      });
    }
  }, [game, myPlayerId]);

  const handleModalSubmit = (enteredId) => {
    console.log("Modal submitted Game ID: ", enteredId);
    setGameId(enteredId);
  };

  const handleCancel = () => {
    setSelectedTerritoryId(null);
  };

  // Render helpers
  const renderLoadingState = () => (
    <div className="loading-state">
      <div className="loading-spinner"></div>
      <span>Loading game...</span>
    </div>
  );

  const renderErrorState = () => (
    <div className="error-state">
      <div>⚠️ Error: {error}</div>
      <button onClick={() => window.location.reload()}>🔄 Retry</button>
    </div>
  );

  const renderWaitingState = () => (
    <div className="waiting-state">
      🎮 No game loaded. Waiting for Game ID or connection...
    </div>
  );

  const renderApiError = () => error && game ? <div className="api-error">Error: {error}</div> : null;

  const renderGameContent = () => (
    <div className="App">
      <div className="space-y-4">
        {renderApiError()}
      </div>

      <GameInfo
        players={game.players}
        currentPhase={game.currentPhase}
        currentPlayerId={game.currentPlayerId}
      />

      <GameControls
        gamePhase={game.currentPhase}
        selectedTerritory={selectedTerritoryId ? game.territories[selectedTerritoryId] : null}
        targetTerritory={targetTerritoryId ? game.territories[targetTerritoryId] : null}
        currentPlayerId={game.currentPlayerId}
        localPlayerId={myPlayerId}
        remainingToPlaceInUI={uiReinforcements.remainingToPlaceInUI}
        placedOnSelectedTerritory={selectedTerritoryId ? uiReinforcements.placements[selectedTerritoryId] || 0 : 0}
        onUiIncrementPlacement={handleUiIncrementPlacement}
        onUiDecrementPlacement={handleUiDecrementPlacement}
        onConfirmAllReinforcements={handleConfirmAllReinforcements}
        onAttack={handleAttack}
        onFortify={handleFortify}
        onEndTurn={handleEndTurn}
        onCancel={handleCancel}
        open={gameControlsOpen}
        onClose={() => setGameControlsOpen(false)}
      />

      <Map
        territories={game.territories}
        uiPlacements={uiReinforcements.placements}
        onTerritoryClick={handleTerritoryClick}
        selectedTerritoryId={selectedTerritoryId}
        targetTerritoryId={targetTerritoryId}
        players={game.players}
      />

      <div className="signalr-status" style={{ marginTop: '20px' }}>
        SignalR: {connection?.state || 'Disconnected'}
      </div>
    </div>
  );

  // Main render logic
  if (!gameId && !isLoading) {
    return <GameIdModal isOpen={true} onSubmit={handleModalSubmit} />;
  }

  if (isLoading) {
    return renderLoadingState();
  }

  if (error && !game) {
    return renderErrorState();
  }

  if (!game) {
    return renderWaitingState();
  }

  return renderGameContent();
}

export default App;