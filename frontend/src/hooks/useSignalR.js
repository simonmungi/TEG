import { useState, useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export const useSignalR = (gameId, API_BASE_URL, onGameStateUpdated) => {
  const [connection, setConnection] = useState(null);

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
      .withUrl(`${API_BASE_URL}/gamehub`)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    newConnection.start()
      .then(() => {
        newConnection.invoke("JoinGameGroup", gameId.toString())
          .then(() => console.log(`Joined game group ${gameId}`))
          .catch(err => console.error('Error joining game group: ', err));

        newConnection.on("GameStateUpdated", (updatedGame) => {
          if (updatedGame && updatedGame.id === gameId) {
            console.log(">>> SIGNALR: Updating local game state.");
            onGameStateUpdated(updatedGame);
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
  }, [gameId, API_BASE_URL]);

  return connection;
};