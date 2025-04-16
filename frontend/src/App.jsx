// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import Map from './components/Map'; // Asumiendo que Map está en components
import GameControls from './components/GameControls'; // Crearemos este componente
import GameInfo from './components/GameInfo'; // Crearemos este componente
import GameIdModal from './components/GameIdModal';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5011';

function App() {
  const [game, setGame] = useState(null); // Estado completo del juego
  const [gameId, setGameId] = useState(null); // ID de la partida actual
  const [connection, setConnection] = useState(null); // Conexión SignalR
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null); // Territorio origen seleccionado
  const [targetTerritoryId, setTargetTerritoryId] = useState(null);   // Territorio destino seleccionado
  const [arrayConexiones, setArrayConexiones] = useState([]);

  const currentPlayerId = game?.players.find(p => p.id === game?.currentPlayerId)?.id || game?.players[0]?.id;

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
        setGame(data);
      } catch (err) {
        console.error("Error fetching game:", err);
        setError(err.message);
        setGame(null); // Limpiar estado si hay error
        setGameId(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGame();
  }, [gameId]); // Se ejecuta cuando gameId cambia

  // --- Efecto para la conexión SignalR ---
  useEffect(() => {
    if (!gameId || !game) return;

    const newConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/gamehub`) // Ruta del Hub en el backend
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    // Iniciar conexión y unirse al grupo
    newConnection.start()
      .then(() => {
        console.log('SignalR Connected.');
        // Unirse al grupo específico de esta partida
        newConnection.invoke("JoinGameGroup", gameId.toString())
          .then(() => console.log(`Joined game group ${gameId}`))
          .catch(err => console.error('Error joining game group: ', err));

        // Escuchar actualizaciones del estado del juego
        newConnection.on("GameStateUpdated", (updatedGame) => {
          console.log("GameStateUpdated received:", updatedGame);
          setGame(updatedGame);
          setSelectedTerritoryId(null);
          setTargetTerritoryId(null);
        });
      })
      .catch(e => console.error('SignalR Connection failed: ', e));

    // Limpieza al desmontar el componente
    return () => {
      console.log("Stopping SignalR connection");
      newConnection.stop().catch(err => console.error("Error stopping SignalR:", err));
    };
  }, [gameId]); // Se ejecuta cuando gameId cambia


  // useEffect(() => {
  //   const manejarTecla = (e) => {
  //     if (e.key.toLowerCase() === 'c') {
  //       console.log('Tecla "c" presionada');
  //       setArrayConexiones([]);
  //     }
  //   };

  //   document.addEventListener('keydown', manejarTecla);

  //   return () => {
  //     document.removeEventListener('keydown', manejarTecla);
  //   };
  // }, []);


  const handleModalSubmit = (enteredId) => {
    console.log("Modal submitted Game ID: ", enteredId);
    setGameId(enteredId);
  }

  // --- Manejadores de Acciones ---

  useEffect(() => {
    console.log(`{${arrayConexiones.map(id => `"${id}"`).join(', ')}}`);
  }, [arrayConexiones]);

  const handleTerritoryClick = useCallback((territoryId) => {
    if (!game || game.currentPlayerId !== currentPlayerId) {
      console.log("Not your turn or no game loaded.");
      return;
    }

    const territory = game.territories[territoryId];
    if (!territory) return;

    console.log(`Clicked on territory: ${territory.name} ID: ${territory.id} (Owner: ${territory.ownerPlayerId}, Armies: ${territory.armies})`);
    console.log("Game Phase: "+game.currentPhase);
    switch (game.currentPhase) {
      case 'Reinforcement':
        if (territory.ownerPlayerId === currentPlayerId) {
          setSelectedTerritoryId(territoryId); // Selecciona para reforzar
          setTargetTerritoryId(null);
          console.log(`Selected ${territory.name} for reinforcement.`);
        } else {
          setSelectedTerritoryId(null);
          setTargetTerritoryId(null);
        }
        break;

      case 'Attack':
        if (selectedTerritoryId === null && territory.ownerPlayerId === currentPlayerId && territory.armies > 1) {
          setSelectedTerritoryId(territoryId); // Selecciona origen del ataque
          setTargetTerritoryId(null);
          console.log(`Selected ${territory.name} as attack origin.`);
        } else if (selectedTerritoryId !== null && territory.ownerPlayerId !== currentPlayerId) {
          if (game.territories[selectedTerritoryId]?.adjacentTerritoryIds.includes(territoryId)) {
            setTargetTerritoryId(territoryId); // Selecciona destino del ataque
            console.log(`Selected ${territory.name} as attack target.`);
          } else {
            console.log("Target territory is not adjacent.");
            // Podrías deseleccionar origen aquí o mostrar mensaje
          }

        } else {
          // Clic inválido en esta fase (ej. clic en propio territorio como destino)
          setSelectedTerritoryId(null);
          setTargetTerritoryId(null);
        }
        break;

      case 'Fortification':
        if (selectedTerritoryId === null && territory.ownerPlayerId === currentPlayerId && territory.armies > 1) {
          setSelectedTerritoryId(territoryId);
          setTargetTerritoryId(null);
          console.log(`Selected ${territory.name} as fortify origin.`);
        } else if (selectedTerritoryId !== null && territory.ownerPlayerId === currentPlayerId && territoryId !== selectedTerritoryId) {
          setTargetTerritoryId(territoryId);
          console.log(`Selected ${territory.name} as fortify target.`);
        } else {
          setSelectedTerritoryId(null);
          setTargetTerritoryId(null);
        }
        break;

      default:
        console.log("Cannot select territory in phase:", game.currentPhase);
        setSelectedTerritoryId(null);
        setTargetTerritoryId(null);
        break;
    }
  }, [game, currentPlayerId, selectedTerritoryId]); // Dependencias del callback

  // --- Funciones para llamar a la API (ejemplos) ---

  const executeApiCall = async (endpoint, method, body) => {
    setError(null);
    try {
      console.log(`Calling API: ${method} ${endpoint}`, body);
      const urlToFetch = `${API_BASE_URL}/${endpoint}`;

      const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}</span>{endpoint}`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json(); // Intentar leer el mensaje de error del backend
        console.error("API Error Response:", errorData);
        throw new Error(errorData.message || errorData.title || `Error: ${response.statusText}`);
      }

      // const result = await response.json();
      console.log(`API Call ${method} ${endpoint} successful.`);
      // La actualización del estado 'game' vendrá por SignalR ("GameStateUpdated")
      return true;

    } catch (err) {
      console.error(`API call failed (${method} ${endpoint}):`, err);
      setError(err.message || "An unknown error occurred.");
      return false;
    } finally {
      setSelectedTerritoryId(null);
      setTargetTerritoryId(null);
    }
  };

  const handleReinforce = (armyCount) => {
    if (!selectedTerritoryId || armyCount <= 0 || !game || !currentPlayerId) return;
    console.log(`Attempting reinforce on ${selectedTerritoryId} with ${armyCount} armies`);
    executeApiCall(
      `/api/games/${gameId}/reinforce`,
      'POST',
      { playerId: currentPlayerId, territoryId: selectedTerritoryId, armyCount }
    );
  };

  const handleAttack = (armyCount) => {
    if (!selectedTerritoryId || !targetTerritoryId || armyCount <= 0 || !game || !currentPlayerId) return;
    console.log(`Attempting attack from ${selectedTerritoryId} to ${targetTerritoryId} with ${armyCount} armies`);
    executeApiCall(
      `/api/games/${gameId}/attack`,
      'POST',
      {
        playerId: currentPlayerId,
        attackingTerritoryId: selectedTerritoryId,
        defendingTerritoryId: targetTerritoryId,
        attackingArmies: armyCount
      }
    );
  };

  const handleFortify = (armyCount) => {
    if (!selectedTerritoryId || !targetTerritoryId || armyCount <= 0 || !game || !currentPlayerId) return;
    console.log(`Attempting fortify from ${selectedTerritoryId} to ${targetTerritoryId} with ${armyCount} armies`);
    executeApiCall(
      `/api/games/${gameId}/fortify`,
      'POST',
      {
        playerId: currentPlayerId,
        fromTerritoryId: selectedTerritoryId,
        toTerritoryId: targetTerritoryId,
        armyCount
      }
    );
  };

  const handleEndTurn = () => {
    if (!game || !currentPlayerId) return;
    console.log("Attempting to end turn");
    executeApiCall(
      `/api/games/${gameId}/endturn`,
      'POST',
      { playerId: currentPlayerId } // Objeto simple con playerId
    );
    setSelectedTerritoryId(null);
    setTargetTerritoryId(null);
  };

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

  const territoriesArray = Object.values(game.territories || {});
  if (game) {
    const territoriesArray = Object.values(game.territories || {});
    const renderApiError = error ? <div className="api-error">Error: {error}</div> : null;

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
        <Map
          territories={territoriesArray}
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