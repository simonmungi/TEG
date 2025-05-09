// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import Map from './components/Map'; // Asumiendo que Map está en components
import GameControls from './components/GameControls'; // Crearemos este componente
import GameInfo from './components/GameInfo'; // Crearemos este componente
import GameIdModal from './components/GameIdModal';
import './App.css';
import { useGameActions } from './hooks/useGameHandlers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5011';

function App() {
  const [game, setGame] = useState(null);
  const [gameId, setGameId] = useState(null); // ID de la partida actual
  const [connection, setConnection] = useState(null); // Conexión SignalR
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [targetTerritoryId, setTargetTerritoryId] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);

  const [uiReinforcements, setUiReinforcements] = useState({
    initialTotalForTurn: 0,
    remainingToPlaceInUI: 0,
    placements: {}
  });

  const {
    handleTerritoryClick,
    handleUiIncrementPlacement,
    handleUiDecrementPlacement,
    handleConfirmAllReinforcements,
    handleEndTurn,
    handleAttack,
    handleFortify,
    executeApiCall // Si lo mueves y lo devuelves
  } = useGameActions({
    game, setGame,
    gameId,
    myPlayerId,
    uiReinforcements, setUiReinforcements,
    selectedTerritoryId, setSelectedTerritoryId,
    targetTerritoryId, setTargetTerritoryId,
    setError,
    API_BASE_URL
  });

  // --- Efecto para obtener el estado inicial del juego ---
  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const urlToFetch = `${API_BASE_URL}/api/games/${gameId}`;
        const response = await fetch(urlToFetch);
        if (!response.ok) {
          throw new Error(`Error fetching game: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Initial game state fetched:", data);

        if (data && data.players && data.players.length > 0) {
          const localPlayerToAssume = data.players.find(p => p.id === data.currentPlayerId);
          if (localPlayerToAssume) {
            console.log(`Asumiendo ser el jugador: ${localPlayerToAssume.name} (ID: ${localPlayerToAssume.id})`);
            setMyPlayerId(localPlayerToAssume.id);
          }
        }

        setGame(data);
      } catch (err) {
        console.error("Error fetching game:", err);
        setError(err.message);
        setGame(null);
        setGameId(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGame();
  }, [gameId]);

  // --- Efecto para la conexión SignalR ---
  useEffect(() => {

    if (!gameId) {
      if (connection) {
        console.log("No gameId, stopping existing SignalR connection.");
        connection.stop().catch(err => console.error("Error stopping SignalR on gameId clear:", err));
        setConnection(null);
      }
      return;
    }

    const newConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/gamehub`) // Ruta del Hub en el backend
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    newConnection.start()
      .then(() => {
        //console.log('>>> SIGNALR: Connection established successfully!');
        newConnection.invoke("JoinGameGroup", gameId.toString())
          .then(() => console.log(`Joined game group ${gameId}`))
          .catch(err => console.error('Error joining game group: ', err));

        // Escuchar actualizaciones del estado del juego
        newConnection.on("GameStateUpdated", (updatedGame) => {
          //console.log(">>> SIGNALR: GameStateUpdated RECEIVED:", updatedGame);
          if (updatedGame && updatedGame.id === gameId) {
            console.log(">>> SIGNALR: Updating local game state.");
            setGame(updatedGame);
            setSelectedTerritoryId(null);
            setTargetTerritoryId(null);
            setError(null);
          } else {
            console.log(">>> SIGNALR: Received update for different game ID:", updatedGame?.id);
          }
        });

        newConnection.onclose(error => {
          console.error('>>> SIGNALR: Connection closed unexpectedly.', error);
        });

      })
      .catch(e => {
        console.error('>>> SIGNALR: Connection failed to start:', e);
        setConnection(null);
      });

    // Limpieza
    return () => {
      if (newConnection) {
        console.log(">>> SIGNALR: Cleaning up SignalR connection for gameId:", gameId);
        newConnection.invoke("LeaveGameGroup", gameId.toString())
          .catch(err => console.error('>>> SIGNALR: Error leaving game group on cleanup: ', err))
          .finally(() => {
            newConnection.stop()
              .then(() => console.log(">>> SIGNALR: Connection stopped successfully."))
              .catch(err => console.error(">>> SIGNALR: Error stopping SignalR on cleanup:", err));
          });
      }
    };
  }, [gameId]);

  useEffect(() => {
  if (game) {
    if (game.currentPhase === 'Reinforcement' && game.currentPlayerId === myPlayerId) {

      const currentUiTotalPlaced = Object.values(uiReinforcements.placements).reduce((sum, count) => sum + count, 0);
      const expectedRemainingInUi = uiReinforcements.initialTotalForTurn - currentUiTotalPlaced;

      if ( (uiReinforcements.initialTotalForTurn === 0 && game.pendingReinforcements > 0) ||
           (game.pendingReinforcements !== uiReinforcements.remainingToPlaceInUI && Object.keys(uiReinforcements.placements).length === 0) ||
           (uiReinforcements.initialTotalForTurn > 0 && game.pendingReinforcements > uiReinforcements.remainingToPlaceInUI) 
        ) {
        setUiReinforcements({
          initialTotalForTurn: game.pendingReinforcements,
          remainingToPlaceInUI: game.pendingReinforcements,
          placements: {} 
        });
      }
    } else {

      if (Object.keys(uiReinforcements.placements).length > 0 || uiReinforcements.remainingToPlaceInUI !== 0 || uiReinforcements.initialTotalForTurn !== 0) {
        console.log("[UI Reinforcement] Not in our Reinforcement phase. Clearing UI state. Current Phase:", game.currentPhase);
        setUiReinforcements({
          initialTotalForTurn: 0,
          remainingToPlaceInUI: 0,
          placements: {}
        });
      }
    }
  }
}, [game, myPlayerId]);

  const handleModalSubmit = (enteredId) => {
    console.log("Modal submitted Game ID: ", enteredId);
    setGameId(enteredId);
  }

  // --- Renderizado ---

  if (!gameId && !isLoading) {
    return <GameIdModal isOpen={true} onSubmit={handleModalSubmit} />
  }

  if (isLoading) {
    return <div>Loading game...</div>;
  }

  if (error && !game) {
    return <div>Error: {error} <button onClick={() => window.location.reload()}>Retry</button></div>;
  }
  const renderApiError = error && game ? <div className="api-error">Error: {error}</div> : null;

  if (!game) {
    return <div>No game loaded. Waiting for Game ID or connection...</div>;
  }

  if (game) {
    const renderApiError = error ? <div className="api-error">Error: {error}</div> : null;
    const selectedTerritoryObject = selectedTerritoryId ? game.territories[selectedTerritoryId] : null;
    const targetTerritoryObject = targetTerritoryId ? game.territories[targetTerritoryId] : null;

    return (
      <div className="App">
        <h1>TEG</h1>
        <div className="space-y-4">
          {renderApiError}
        </div>

        <GameInfo
          players={game.players}
          currentPhase={game.currentPhase}
          currentPlayerId={game.currentPlayerId}
        />

        <GameControls
          gamePhase={game.currentPhase}
          selectedTerritory={selectedTerritoryId ? game.territories[selectedTerritoryId] : null}
          currentPlayerId={game.currentPlayerId}
          localPlayerId={myPlayerId}
          remainingToPlaceInUI={uiReinforcements.remainingToPlaceInUI}
          placedOnSelectedTerritory={selectedTerritoryId ? uiReinforcements.placements[selectedTerritoryId] : 0}
          
          onUiIncrementPlacement={handleUiIncrementPlacement}
          onUiDecrementPlacement={handleUiDecrementPlacement}
          onConfirmAllReinforcements={handleConfirmAllReinforcements}
          onAttack={handleAttack}
          onFortify={handleFortify}
          onEndTurn={handleEndTurn}
          onCancel={() => { setSelectedTerritoryId(null); }}
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
  }

  return <div>Cargando aplicación...</div>;
}

export default App;