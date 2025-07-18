import { useCallback } from "react";
import axios from 'axios';

export const useGameActions = ({
    game, setGame, // Ejemplo, podrías no necesitar setGame directamente si SignalR actualiza
    gameId,
    myPlayerId,
    uiReinforcements, setUiReinforcements,
    selectedTerritoryId, setSelectedTerritoryId,
    targetTerritoryId, setTargetTerritoryId,
    setError,
    API_BASE_URL
}) => {

    const executeApiCall = useCallback(async (endpoint, method, body) => {
        setError(null);
        const url = `${API_BASE_URL}${endpoint}`;

        console.log(`Calling API (Axios): ${method} ${url}`, body);

        try {
            let response;
            const config = {
                headers: {}
            };

            const lowerCaseMethod = method.toLowerCase();

            switch (lowerCaseMethod) {
                case 'get':
                    response = await axios.get(url, { ...config, params: body });
                    break;
                case 'post':
                    response = await axios.post(url, body, config);
                    break;
                case 'put':
                    response = await axios.put(url, body, config);
                    break;
                case 'delete':
                    response = await axios.delete(url, { ...config, data: body });
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${method}`);
            }

            console.log(`API Call ${method} ${url} successful. Response data:`, response.data);

            return true;

        } catch (error) {
            console.error(`API call failed (${method} ${url}):`, error);

            if (axios.isAxiosError(error)) {
                if (error.response) {
                    console.error('Error Data:', error.response.data);
                    console.error('Error Status:', error.response.status);
                    const message = error.response.data?.message
                        || error.response.data?.title
                        || (typeof error.response.data === 'string' ? error.response.data : `Server error (${error.response.status})`);
                    setError(message);
                } else if (error.request) {
                    console.error('Error Request:', error.request);
                    setError('Network Error: No response received from server.');
                } else {
                    console.error('Error Message:', error.message);
                    setError(`Request Setup Error: ${error.message}`);
                }
            } else {
                setError(error.message || 'An unknown error occurred.');
            }
            return false;

        } finally {
            setSelectedTerritoryId(null);
            setTargetTerritoryId(null);
            console.log("Cleared selections in finally block.");
        }

    }, [API_BASE_URL, setError, setSelectedTerritoryId, setTargetTerritoryId]);

    const handleTerritoryClick = useCallback((territoryId) => {
        if (!game || game.currentPlayerId !== myPlayerId) {
            console.log("currentPlayerId",game.currentPlayerId);
            console.log("myPlayerId",myPlayerId);
            console.log("Not your turn or no game loaded.");
            return;
        }

        const territory = game.territories[territoryId];
        if (!territory) return;

        //console.log(`Clicked on territory: ${territory.name} ID: ${territory.id} (Owner: ${territory.ownerPlayerId}, Armies: ${territory.armies})`);
        //console.log("Game Phase: " + game.currentPhase);
        switch (game.currentPhase) {
            case 'Reinforcement':
                if (territory.ownerPlayerId === myPlayerId) {
                    setSelectedTerritoryId(territoryId); // Selecciona para reforzar
                    setTargetTerritoryId(null);
                    console.log(`Selected ${territory.name} for reinforcement.`);
                } else {
                    setSelectedTerritoryId(null);
                    setTargetTerritoryId(null);
                }
                break;

            case 'Attack':
                if (selectedTerritoryId === null && territory.ownerPlayerId === myPlayerId && territory.armies > 1) {
                    setSelectedTerritoryId(territoryId); // Selecciona origen del ataque
                    setTargetTerritoryId(null);
                    console.log(`Selected ${territory.name} as attack origin.`);
                } else if (selectedTerritoryId !== null && territory.ownerPlayerId !== myPlayerId) {
                    if (game.territories[selectedTerritoryId]?.adjacentTerritoryIds.includes(territoryId)) {
                        setTargetTerritoryId(territoryId); // Selecciona destino del ataque
                        console.log(`Selected ${territory.name} as attack target.`);
                    } else {
                        console.log("Target territory is not adjacent.");
                    }

                } else {
                    // Clic inválido en esta fase (ej. clic en propio territorio como destino)
                    setSelectedTerritoryId(null);
                    setTargetTerritoryId(null);
                }
                break;

            case 'Fortification':
                if (selectedTerritoryId === null && territory.ownerPlayerId === myPlayerId && territory.armies > 1) {
                    setSelectedTerritoryId(territoryId);
                    setTargetTerritoryId(null);
                    console.log(`Selected ${territory.name} as fortify origin.`);
                } else if (selectedTerritoryId !== null && territory.ownerPlayerId === myPlayerId && territoryId !== selectedTerritoryId) {
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
    }, [game, selectedTerritoryId, myPlayerId]);

    const handleUiIncrementPlacement = useCallback((territoryId) => {
        if (uiReinforcements.remainingToPlaceInUI <= 0) return;

        setUiReinforcements(prev => ({
            ...prev,
            remainingToPlaceInUI: prev.remainingToPlaceInUI - 1,
            placements: {
                ...prev.placements,
                [territoryId]: (prev.placements[territoryId] || 0) + 1
            }
        }));
    }, [uiReinforcements, setUiReinforcements]);

    const handleUiDecrementPlacement = useCallback((territoryId) => {
        if (!uiReinforcements.placements[territoryId] || uiReinforcements.placements[territoryId] <= 0) return;
        if (uiReinforcements.remainingToPlaceInUI >= uiReinforcements.initialTotalForTurn) return;

        setUiReinforcements(prev => ({
            ...prev,
            remainingToPlaceInUI: prev.remainingToPlaceInUI + 1,
            placements: {
                ...prev.placements,
                [territoryId]: prev.placements[territoryId] - 1
            }
        }));
    }, [uiReinforcements, setUiReinforcements]);

    const handleConfirmAllReinforcements = useCallback(async () => {

        if (uiReinforcements.remainingToPlaceInUI !== 0) {
            setError("Aún hay refuerzos por colocar.");
            return;
        }

        if (Object.keys(uiReinforcements.placements).length === 0 && uiReinforcements.initialTotalForTurn > 0) {

        }

        const placementsToSend = Object.entries(uiReinforcements.placements)
            .filter(([territoryId, count]) => count > 0)
            .map(([territoryId, count]) => ({ territoryId, armyCount: count }));

        const success = await executeApiCall(
            `/api/games/${gameId}/reinforcements/commit`, // Nuevo endpoint
            'POST',
            {
                playerId: myPlayerId, // Importante: enviar quién está haciendo la acción
                placements: placementsToSend
            }
        );

    }, [uiReinforcements, gameId, myPlayerId, executeApiCall, setError]);

    const handleEndTurn = useCallback(async () => {
        if (!game || !myPlayerId) return;
        console.log("Attempting to end turn");
        executeApiCall(
            `/api/games/${gameId}/endturn`,
            'POST',
            { playerId: myPlayerId }
        );
        setSelectedTerritoryId(null);
        setTargetTerritoryId(null);
    }, [game, myPlayerId, gameId, executeApiCall]); 

    const handleAttack = useCallback(async (armyCount) => {
        if (!selectedTerritoryId || !targetTerritoryId || armyCount <= 0 || !game || !myPlayerId) return;
        console.log(`Attempting attack from ${selectedTerritoryId} to ${targetTerritoryId} with ${armyCount} armies`);
        executeApiCall(
            `/api/games/${gameId}/attack`,
            'POST',
            {
                playerId: myPlayerId,
                attackingTerritoryId: selectedTerritoryId,
                defendingTerritoryId: targetTerritoryId,
                attackingArmies: armyCount
            }
        );
    }, [selectedTerritoryId, targetTerritoryId, game, myPlayerId, gameId, executeApiCall]);

    const handleFortify = useCallback(async (armyCount) => {
        if (!selectedTerritoryId || !targetTerritoryId || armyCount <= 0 || !game || !myPlayerId) return;
        console.log(`Attempting fortify from ${selectedTerritoryId} to ${targetTerritoryId} with ${armyCount} armies`);
        executeApiCall(
            `/api/games/${gameId}/fortify`,
            'POST',
            {
                playerId: myPlayerId,
                fromTerritoryId: selectedTerritoryId,
                toTerritoryId: targetTerritoryId,
                armyCount
            }
        );
    }, [selectedTerritoryId, targetTerritoryId, game, myPlayerId, gameId, executeApiCall]);

    return {
        handleTerritoryClick,
        handleUiIncrementPlacement,
        handleUiDecrementPlacement,
        handleConfirmAllReinforcements,
        handleEndTurn,
        handleAttack,
        handleFortify,
        executeApiCall
    };
};