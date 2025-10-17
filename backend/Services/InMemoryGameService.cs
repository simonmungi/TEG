using System.Collections.Concurrent;
using backend.Hubs;
using backend.Models;
using backend.Models.RequestsDTOs;
using Microsoft.AspNetCore.SignalR;

namespace backend.Services
{

    public class InMemoryGameService : IGameService
    {
        private static readonly ConcurrentDictionary<Guid, Game> _activeGames = new ConcurrentDictionary<Guid, Game>();
        private readonly IHubContext<GameHub> _hubContext;
        private static readonly Random _random = new Random();

        public InMemoryGameService(IHubContext<GameHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task<Game> CreateNewGameAsync(List<Player> initialPlayers)
        {

            if (initialPlayers == null || !initialPlayers.Any())
            {
                initialPlayers = new List<Player>
                {
                    new Player { Name = "Jugador 1", Color = "Blue" },
                    new Player { Name = "Jugador 2", Color = "Green" },
                    new Player { Name = "Jugador 3", Color = "Yellow" },
                    new Player { Name = "Jugador 4", Color = "Red" },
                };
            }
            else
            {
                foreach (var p in initialPlayers.Where(p => string.IsNullOrEmpty(p.Id)))
                {
                    p.Id = Guid.NewGuid().ToString();
                }
            }

            var newGame = new Game
            {
                Players = initialPlayers ?? new List<Player>()
            };

            //initialize map
            var territories_extended = MapData.populateTerritories();
            foreach (var t in territories_extended)
            {
                newGame.Territories.Add(t.Id, t);
            }

            //Assign initial territories
            //if (!newGame.Players.Any()) return;
            var randomTerritoryIds = newGame.Territories.Keys.ToList();
            var random = new Random();
            randomTerritoryIds = randomTerritoryIds.OrderBy(t => random.Next()).ToList();

            int playerIndex = 0;
            foreach (var territoryId in randomTerritoryIds)
            {
                var territory = newGame.Territories[territoryId];
                var owner = newGame.Players[playerIndex % newGame.Players.Count];
                territory.OwnerPlayerId = owner.Id;
                territory.Armies = 1;
                playerIndex++;
            }

            //setup turn order
            newGame.TurnOrder = newGame.Players.Select(p => p.Id).OrderBy(id => random.Next()).ToList();

            //setup initial phase
            newGame.CurrentPhase = newGame.Players.Any() ? GamePhase.Reinforcement : GamePhase.WaitingForPlayers;
            newGame.CurrentPlayerId = newGame.TurnOrder.FirstOrDefault();

            if (!string.IsNullOrEmpty(newGame.CurrentPlayerId))
            {
                newGame.CurrentPhase = GamePhase.Reinforcement;
                newGame.PendingReinforcements = CalculateReinforcementForPlayer(newGame, newGame.CurrentPlayerId);
            }
            else
            {
                newGame.CurrentPhase = GamePhase.WaitingForPlayers; // O GameOver
                newGame.PendingReinforcements = 0;
            }

            _activeGames.TryAdd(newGame.Id, newGame);

            await NotifyGameStateUpdate(newGame);

            return newGame;
        }

        public Task<Game?> GetGameAsync(Guid gameId)
        {
            _activeGames.TryGetValue(gameId, out var game);
            return Task.FromResult(game);
        }

        // public async Task<(bool Success, string Message, Game? GameState)> ReinforceAsync(Guid gameId, ReinforceRequest request)
        // {
        //     if (!_activeGames.TryGetValue(gameId, out var game))
        //         return (false, "Partida no encontrada", null);

        //     var validationResult = ValidateReinforce(game, request);
        //     if (!validationResult.Success)
        //         return (validationResult.Success, validationResult.Message, validationResult.GameState);

        //     var territory = validationResult.Territory!;
        //     territory.Armies += request.ArmyCount;
        //     game.PendingReinforcements -= request.ArmyCount;

        //     await NotifyGameStateUpdate(game);
        //     await EndTurnAsync(gameId, game.CurrentPlayerId);

        //     return (true, $"{request.ArmyCount} ejércitos añadidos a {territory.Name}.", game);
        // }

        private (bool Success, string Message, Game? GameState, Territory? Territory) ValidateReinforce(Game game, ReinforceRequest request)
        {
            if (game.CurrentPlayerId != request.PlayerId)
                return (false, "No es tu turno.", game, null);

            if (game.CurrentPhase != GamePhase.Reinforcement)
                return (false, "No estás en la fase de refuerzo.", game, null);

            if (!game.Territories.TryGetValue(request.TerritoryId, out var territory))
                return (false, "Territorio no encontrado.", game, null);

            if (territory.OwnerPlayerId != request.PlayerId)
                return (false, "No puedes reforzar un territorio que no te pertenece.", game, territory);

            if (request.ArmyCount <= 0) // Duplicada validación, se puede quitar una.
                return (false, "Debes reforzar con al menos 1 ejército.", game, territory);

            if (request.ArmyCount > game.PendingReinforcements)
                return (false, $"No puedes colocar {request.ArmyCount} ejércitos. Solo tienes {game.PendingReinforcements} refuerzos disponibles.", game, territory);

            return (true, "Validación de refuerzo exitosa.", game, territory);
        }

        public async Task<AttackResult> AttackAsync(Guid gameId, AttackRequest request)
        {
            var result = new AttackResult { Success = false };
            if (!_activeGames.TryGetValue(gameId, out var game))
            {
                result.Message = "Partida no encontrada.";
                return result;
            }
            result.UpdatedGameState = game;

            var validationResult = ValidateAttack(game, request);
            if (!validationResult.Success)
            {
                result.Message = validationResult.Message;
                return result;
            }

            var attackerTerritory = validationResult.AttackingTerritory!;
            var defenderTerritory = validationResult.DefendingTerritory!;

            // --- Lógica de Dados ---
            int attackerDiceCount = Math.Min(request.AttackingArmies, 3); // Máx 3 dados atacantes
            int defenderDiceCount = Math.Min(defenderTerritory.Armies, 2); // Máx 2 dados defensores

            result.AttackerDiceRolls = RollDice(attackerDiceCount);
            result.DefenderDiceRolls = RollDice(defenderDiceCount);

            result.AttackerDiceRolls.Sort((a, b) => b.CompareTo(a)); // Ordenar descendente
            result.DefenderDiceRolls.Sort((a, b) => b.CompareTo(a));

            int pairsToCompare = Math.Min(attackerDiceCount, defenderDiceCount);
            result.AttackerLosses = 0;
            result.DefenderLosses = 0;

            for (int i = 0; i < pairsToCompare; i++)
            {
                if (result.AttackerDiceRolls[i] > result.DefenderDiceRolls[i])
                {
                    result.DefenderLosses++;
                }
                else // Empate o gana defensor
                {
                    result.AttackerLosses++;
                }
            }

            // --- Actualizar Ejércitos ---
            attackerTerritory.Armies -= result.AttackerLosses;
            defenderTerritory.Armies -= result.DefenderLosses;

            // --- Chequear Conquista ---
            if (defenderTerritory.Armies <= 0)
            {
                result.TerritoryConquered = true;
                defenderTerritory.OwnerPlayerId = request.PlayerId; // Cambiar dueño
                // Mover ejércitos atacantes al territorio conquistado (mínimo los que atacaron, menos pérdidas)
                int armiesToMove = Math.Max(1, request.AttackingArmies - result.AttackerLosses); // Mover al menos 1
                armiesToMove = Math.Min(armiesToMove, attackerTerritory.Armies - 1); // No mover todos si quedan más de 1

                if (attackerTerritory.Armies - armiesToMove < 1) armiesToMove = attackerTerritory.Armies - 1; // Asegurar que quede 1

                if (armiesToMove > 0)
                {
                    defenderTerritory.Armies = armiesToMove;
                    attackerTerritory.Armies -= armiesToMove;
                }
                else
                { // Si no sobrevivió ningún ejército atacante específico, mover 1 por defecto si es posible
                    if (attackerTerritory.Armies > 1)
                    {
                        defenderTerritory.Armies = 1;
                        attackerTerritory.Armies -= 1;
                    }
                    else
                    {
                        // Situación rara: conquistó pero no puede mover el mínimo. Revertir conquista? O dejar con 0 temporalmente?
                        defenderTerritory.Armies = 0; // Temporal?
                                                      // Esto podría necesitar más lógica de reglas
                    }
                }

                result.Message = $"{defenderTerritory.Name} conquistado";
                // TODO: Chequear condiciones de victoria (eliminación de jugador, objetivos)
            }
            else
            {
                result.Message = $"Ataque resuelto. Atacante pierde {result.AttackerLosses}, Defensor pierde {result.DefenderLosses}.";
            }

            result.Success = true;
            result.UpdatedGameState = game;
            await NotifyGameStateUpdate(game);
            return result;
        }

        private (bool Success, string Message, Game? GameState, Territory? AttackingTerritory, Territory? DefendingTerritory) ValidateAttack(Game game, AttackRequest request)
        {
            if (game.CurrentPlayerId != request.PlayerId)
                return (false, "No es tu turno.", game, null, null);

            if (game.CurrentPhase != GamePhase.Attack)
                return (false, "No estás en la fase de ataque.", game, null, null);

            if (!game.Territories.TryGetValue(request.AttackingTerritoryId, out var attackerTerritory) ||
                !game.Territories.TryGetValue(request.DefendingTerritoryId, out var defenderTerritory))
                return (false, "Uno o ambos territorios no existen.", game, null, null);

            if (attackerTerritory.OwnerPlayerId != request.PlayerId)
                return (false, "El territorio atacante no te pertenece.", game, attackerTerritory, defenderTerritory);

            if (defenderTerritory.OwnerPlayerId == request.PlayerId)
                return (false, "No puedes atacar tu propio territorio.", game, attackerTerritory, defenderTerritory);

            if (defenderTerritory.OwnerPlayerId == null)
                return (false, "No puedes atacar territorios neutrales (implementar reglas si se desea).", game, attackerTerritory, defenderTerritory);

            if (attackerTerritory.AdjacentTerritoriesIds == null || !attackerTerritory.AdjacentTerritoriesIds.Contains(request.DefendingTerritoryId))
                return (false, "Los territorios no son adyacentes.", game, attackerTerritory, defenderTerritory);

            if (attackerTerritory.Armies <= 1)
                return (false, "Necesitas más de 1 ejército para atacar.", game, attackerTerritory, defenderTerritory);

            if (request.AttackingArmies <= 0 || request.AttackingArmies >= attackerTerritory.Armies)
                return (false, $"Número de ejércitos atacantes inválido (1 a {attackerTerritory.Armies - 1}).", game, attackerTerritory, defenderTerritory);

            if (defenderTerritory.Armies <= 0) // Ya debería ser del atacante si tiene 0
                return (false, "El territorio defensor no tiene ejércitos.", game, attackerTerritory, defenderTerritory);

            return (true, "Validación de ataque exitosa.", game, attackerTerritory, defenderTerritory);
        }

        public async Task<(bool Success, string Message, Game? GameState)> FortifyAsync(Guid gameId, FortifyRequest request)
        {
            if (!_activeGames.TryGetValue(gameId, out var game))
                return (false, "Partida no encontrada.", null);

            // --- Validaciones ---
            var validationResult = ValidateFortify(game, request);
            if (!validationResult.Success)
                return validationResult;

            // TODO: Añadir lógica para permitir solo UNA fortificación por turno.

            // --- Ejecución ---
            var fromTerritory = game.Territories[request.FromTerritoryId];
            var toTerritory = game.Territories[request.ToTerritoryId];

            fromTerritory.Armies -= request.ArmyCount;
            toTerritory.Armies += request.ArmyCount;

            await NotifyGameStateUpdate(game);
            return (true, $"{request.ArmyCount} ejércitos movidos de {fromTerritory.Name} a {toTerritory.Name}.", game);
        }

        private (bool Success, string Message, Game? GameState) ValidateFortify(Game game, FortifyRequest request)
        {
            if (game.CurrentPlayerId != request.PlayerId) return (false, "No es tu turno.", game);
            if (game.CurrentPhase != GamePhase.Fortification) return (false, "No estás en la fase de fortificación.", game);

            if (!game.Territories.TryGetValue(request.FromTerritoryId, out var fromTerritory) ||
                !game.Territories.TryGetValue(request.ToTerritoryId, out var toTerritory))
            {
                return (false, "Uno o ambos territorios no existen.", game);
            }

            if (fromTerritory.OwnerPlayerId != request.PlayerId || toTerritory.OwnerPlayerId != request.PlayerId)
            {
                return (false, "Ambos territorios deben pertenecerte.", game);
            }

            if (!AreTerritoriesConnected(game, request.FromTerritoryId, request.ToTerritoryId, request.PlayerId))
            {
                return (false, "Los territorios no están conectados por una cadena de territorios propios.", game);
            }

            if (fromTerritory.Armies <= request.ArmyCount)
            {
                return (false, $"No puedes mover tantos ejércitos (debes dejar al menos 1 en {fromTerritory.Name}).", game);
            }

            if (request.ArmyCount <= 0)
            {
                return (false, "Debes mover al menos 1 ejército.", game);
            }

            return (true, "Validación de fortificación exitosa.", game);
        }

        public async Task<(bool Success, string Message, Game? GameState)> EndTurnAsync(Guid gameId, string playerId)
        {
            if (!_activeGames.TryGetValue(gameId, out var game))
                return (false, "Partida no encontrada.", null);

            var validationResult = ValidateEndTurn(game, playerId);
            if (!validationResult.Success)
                return validationResult;

            int currentPlayerIndex = game.TurnOrder.FindIndex(pId => pId == playerId);
            int nextPlayerIndex = (currentPlayerIndex + 1) % game.TurnOrder.Count;
            string nextPlayerId = game.TurnOrder[nextPlayerIndex];

            game.CurrentPlayerId = nextPlayerId;
            game.CurrentPhase = GamePhase.Reinforcement;
            game.PendingReinforcements = CalculateReinforcementForPlayer(game, nextPlayerId);

            await NotifyGameStateUpdate(game);
            var nextPlayerName = game.Players.FirstOrDefault(p => p.Id == nextPlayerId)?.Name ?? "N/A";
            return (true, $"Turno terminado. Es el turno de {nextPlayerName}. Recibe {game.PendingReinforcements} refuerzos.", game);
        }

        private (bool Success, string Message, Game? GameState) ValidateEndTurn(Game game, string playerId)
        {
            if (game.CurrentPlayerId != playerId)
                return (false, "No puedes terminar el turno de otro jugador.", game);
            if (game.TurnOrder.FindIndex(pId => pId == playerId) == -1)
                return (false, "Jugador no encontrado en el orden de turnos.", game);

            return (true, "Validación de fin de turno exitosa.", game);
        }

        public async Task<(bool Success, string Message, Game? GameState)> CommitReinforcementsAsync(Guid gameId, string playerId, List<ReinforcementPlacementDto> placements)
        {
            if (!_activeGames.TryGetValue(gameId, out var game))
                return (false, "Partida no encontrada.", null);

            var validationResult = ValidateCommitReinforcements(game, playerId, placements);
            if (!validationResult.Success)
                return validationResult;

            foreach (var placement in placements!)
            {
                if (placement.ArmyCount > 0)
                {
                    game.Territories[placement.TerritoryId].Armies += placement.ArmyCount;
                }
            }

            game.PendingReinforcements = 0;
            return await EndTurnAsync(gameId, playerId);
        }

        private (bool Success, string Message, Game? GameState) ValidateCommitReinforcements(Game game, string playerId, List<ReinforcementPlacementDto>? placements)
        {
            if (game.CurrentPlayerId != playerId)
                return (false, "No es tu turno.", game);
            if (game.CurrentPhase != GamePhase.Reinforcement)
                return (false, "No estás en la fase de refuerzo para confirmar.", game);

            if (placements == null)
                return (false, "No se proporcionaron ubicaciones de refuerzo.", game);

            int totalArmiesPlacedByPlayer = placements.Sum(p => p.ArmyCount);

            if (totalArmiesPlacedByPlayer < 0)
                return (false, "La cantidad de ejércitos colocados no puede ser negativa.", game);

            if (totalArmiesPlacedByPlayer != game.PendingReinforcements)
            {
                return (false, $"Debes colocar exactamente {game.PendingReinforcements} ejércitos. Intentaste colocar {totalArmiesPlacedByPlayer}.", game);
            }

            foreach (var placement in placements)
            {
                if (placement.ArmyCount > 0)
                {
                    if (!game.Territories.TryGetValue(placement.TerritoryId, out var territory))
                        return (false, $"Territorio {placement.TerritoryId} no encontrado durante la confirmación.", game);
                    if (territory.OwnerPlayerId != playerId)
                        return (false, $"No puedes reforzar el territorio {territory.Name} porque no te pertenece.", game);
                }
                else if (placement.ArmyCount < 0)
                {
                    return (false, $"No puedes colocar una cantidad negativa de ejércitos en {placement.TerritoryId}.", game);
                }
            }
            return (true, "Validación de confirmación de refuerzos exitosa.", game);
        }

        private List<int> RollDice(int count)
        {
            var rolls = new List<int>();
            for (int i = 0; i < count; i++)
            {
                rolls.Add(_random.Next(1, 7));
            }
            return rolls;
        }

        private bool AreTerritoriesConnected(Game game, string startTerritoryId, string endTerritoryId, string playerId)
        {
            if (startTerritoryId == endTerritoryId) return true;

            var visited = new HashSet<string>();
            var queue = new Queue<string>();

            visited.Add(startTerritoryId);
            queue.Enqueue(startTerritoryId);

            while (queue.Count > 0)
            {
                var currentId = queue.Dequeue();
                if (!game.Territories.TryGetValue(currentId, out var currentTerritory) || currentTerritory.OwnerPlayerId != playerId)
                    continue;

                foreach (var neighborId in currentTerritory.AdjacentTerritoriesIds)
                {
                    if (neighborId == endTerritoryId) return true;

                    if (game.Territories.TryGetValue(neighborId, out var neighborTerritory) &&
                        neighborTerritory.OwnerPlayerId == playerId &&
                        !visited.Contains(neighborId))
                    {
                        visited.Add(neighborId);
                        queue.Enqueue(neighborId);
                    }
                }
            }
            return false; // No se encontró conexión
        }

        private int CalculateReinforcementForPlayer(Game game, string playerId)
        {
            if (string.IsNullOrEmpty(playerId) || !game.Players.Any(p => p.Id == playerId))
                return 0;

            //Regla basica número de territorios / 3, mínimo 3

            int territoriesOwned = game.Territories.Values.Count(t => t.OwnerPlayerId == playerId);
            int calculatedReinforcements = Math.Max(3, territoriesOwned / 3);

            // TODO:
            // - Bonificaciones por continentes completos.
            // - Refuerzos por canje de cartas.
            return calculatedReinforcements;
        }

        private async Task NotifyGameStateUpdate(Game game)
        {
            await _hubContext.Clients.Group(game.Id.ToString()).SendAsync("GameStateUpdated", game);
        }
    }
}