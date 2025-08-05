import { useState, useEffect } from 'react';

export const useGameData = (gameId, API_BASE_URL) => {
  const [game, setGame] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);

  const fetchGame = async () => {
    if (!gameId) return;

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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGame();
  }, [gameId]);

  const updateGame = (newGameData) => {
    setGame(newGameData);
    setError(null);
  };

  return {
    game,
    setGame: updateGame,
    isLoading,
    error,
    setError,
    myPlayerId,
    setMyPlayerId
  };
};