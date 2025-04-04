using System.Collections.Concurrent;
using backend.Hubs;
using backend.Models;
using Microsoft.AspNetCore.SignalR;

namespace backend.Services
{

    public class InMemoryGameService : IGameService
    {
        private static readonly ConcurrentDictionary<Guid, Game> _activeGames = new ConcurrentDictionary<Guid, Game>();
        private readonly IHubContext<GameHub> _hubContext;
        private static readonly Random _random = new Random(); // Para los dados

        public InMemoryGameService(IHubContext<GameHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task<Game> CreateNewGameAsync(List<Player> initialPlayers)
        {
            var newGame = new Game
            {
                Players = initialPlayers ?? new List<Player>()
            };

            InitializeMap(newGame);
            AssignInitialTerritories(newGame);
            SetupTurnOrder(newGame);

            newGame.CurrentPhase = newGame.Players.Any() ? GamePhase.Reinforcement : GamePhase.WaitingForPlayers;
            newGame.CurrentPlayerId = newGame.TurnOrder.FirstOrDefault();

            _activeGames.TryAdd(newGame.Id, newGame);

            await NotifyGameStateUpdate(newGame.Id, newGame);

            return newGame;
        }

        public Task<Game?> GetGameAsync(Guid gameId)
        {
            _activeGames.TryGetValue(gameId, out var game);
            return Task.FromResult(game);

        }

        private void InitializeMap(Game game)
        {
            var territories = new List<Territory>
            {
                new Territory { Id = "arg", Name = "Argentina", AdjacentTerritoriesIds = new List<string> { "bra", "chi" } },
                new Territory { Id = "bra", Name = "Brasil", AdjacentTerritoriesIds = new List<string> { "arg", "per" } },
                new Territory { Id = "chi", Name = "Chile", AdjacentTerritoriesIds = new List<string> { "arg", "per" } },
                new Territory { Id = "per", Name = "Peru", AdjacentTerritoriesIds = new List<string> { "bra", "chi" } }
            };

            foreach (var t in territories)
            {
                game.Territories.Add(t.Id, t);
            }
        }

        private void AssignInitialTerritories(Game game)
        {
            if (!game.Players.Any()) return;

            var territoryIds = game.Territories.Keys.ToList();
            var random = new Random();
            territoryIds = territoryIds.OrderBy(t => random.Next()).ToList();

            int playerIndex = 0;
            foreach (var territoryId in territoryIds)
            {
                var territory = game.Territories[territoryId];
                var owner = game.Players[playerIndex % game.Players.Count];
                territory.OwnerPlayerId = owner.Id;
                territory.Armies = 1;
                playerIndex++;
            }
        }

        private void SetupTurnOrder(Game game)
        {
            var random = new Random();
            game.TurnOrder = game.Players.Select(p => p.Id).OrderBy(id => random.Next()).ToList();
        }

        public async Task<(bool Success, string Message, Game? GameState)> ReinforceAsync(Guid gameId, ReinforceRequest request)
        {
            if (!_activeGames.TryGetValue(gameId, out var game)) return (false, "Partida no encontrada", null);

            if (game.CurrentPlayerId != request.PlayerId) return (false, "No es tu turno.", game);
            if (game.CurrentPhase != GamePhase.Reinforcement) return (false, "No estás en la fase de refuerzo.", game);
            if (!game.Territories.TryGetValue(request.TerritoryId, out var territory)) return (false, "Territorio no encontrado.", game);
            if (territory.OwnerPlayerId != request.PlayerId) return (false, "No puedes reforzar un territorio que no te pertenece.", game);
            if (request.ArmyCount <= 0) return (false, "Debes reforzar con al menos 1 ejército.", game);

            // TODO: Implementar lógica real de cálculo de refuerzos (ej. basado en territorios, continentes, cartas)
            // Por ahora, asumamos que el jugador tiene 'X' refuerzos disponibles y los gasta.
            // Esta validación es crucial y falta aquí.

            territory.Armies += request.ArmyCount;

            await NotifyGameStateUpdate(gameId, game);

            return (true, $"{request.ArmyCount} ejércitos añadidos a {territory.Name}.", game);
        }

        public async Task<AttackResult> AttackAsync(Guid gameId, AttackRequest request)
        {
            var result = new AttackResult { Success = false };
            if (!_activeGames.TryGetValue(gameId, out var game))
            {
                result.Message = "Partida no encontrada.";
                return result;
            }
            result.UpdatedGameState = game; // Devolver estado actual en caso de error de validación

            // --- Validaciones ---
            if (game.CurrentPlayerId != request.PlayerId) { result.Message = "No es tu turno."; return result; }
            if (game.CurrentPhase != GamePhase.Attack) { result.Message = "No estás en la fase de ataque."; return result; }
            if (!game.Territories.TryGetValue(request.AttackingTerritoryId, out var attackerTerritory) ||
                !game.Territories.TryGetValue(request.DefendingTerritoryId, out var defenderTerritory))
            { result.Message = "Uno o ambos territorios no existen."; return result; }
            if (attackerTerritory.OwnerPlayerId != request.PlayerId) { result.Message = "El territorio atacante no te pertenece."; return result; }
            if (defenderTerritory.OwnerPlayerId == request.PlayerId) { result.Message = "No puedes atacar tu propio territorio."; return result; }
            if (defenderTerritory.OwnerPlayerId == null) { result.Message = "No puedes atacar territorios neutrales (implementar reglas si se desea)."; return result; }
            if (!attackerTerritory.AdjacentTerritoriesIds.Contains(request.DefendingTerritoryId)) { result.Message = "Los territorios no son adyacentes."; return result; }
            if (attackerTerritory.Armies <= 1) { result.Message = "Necesitas más de 1 ejército para atacar."; return result; }
            if (request.AttackingArmies <= 0 || request.AttackingArmies >= attackerTerritory.Armies) { result.Message = $"Número de ejércitos atacantes inválido (1 a {attackerTerritory.Armies - 1})."; return result; }
            if (defenderTerritory.Armies <= 0) { result.Message = "El territorio defensor no tiene ejércitos."; return result; } // Ya debería ser del atacante si tiene 0

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
            result.UpdatedGameState = game; // Actualizar el estado que se devuelve
            await NotifyGameStateUpdate(gameId, game); // Notificar a todos
            return result;
        }

        public async Task<(bool Success, string Message, Game? GameState)> FortifyAsync(Guid gameId, FortifyRequest request)
        {
            if (!_activeGames.TryGetValue(gameId, out var game))
                return (false, "Partida no encontrada.", null);

            // --- Validaciones ---
            if (game.CurrentPlayerId != request.PlayerId) return (false, "No es tu turno.", game);
            if (game.CurrentPhase != GamePhase.Fortification) return (false, "No estás en la fase de fortificación.", game);
            if (!game.Territories.TryGetValue(request.FromTerritoryId, out var fromTerritory) || !game.Territories.TryGetValue(request.ToTerritoryId, out var toTerritory))
            { return (false, "Uno o ambos territorios no existen.", game); }
            if (fromTerritory.OwnerPlayerId != request.PlayerId || toTerritory.OwnerPlayerId != request.PlayerId) { return (false, "Ambos territorios deben pertenecerte.", game); }
            if (!AreTerritoriesConnected(game, request.FromTerritoryId, request.ToTerritoryId, request.PlayerId)) { return (false, "Los territorios no están conectados por una cadena de territorios propios.", game); }
            if (fromTerritory.Armies <= request.ArmyCount) { return (false, $"No puedes mover tantos ejércitos (debes dejar al menos 1 en {fromTerritory.Name}).", game); }
            if (request.ArmyCount <= 0) { return (false, "Debes mover al menos 1 ejército.", game); }
            // TODO: Añadir lógica para permitir solo UNA fortificación por turno.

            // --- Ejecución ---
            fromTerritory.Armies -= request.ArmyCount;
            toTerritory.Armies += request.ArmyCount;

            // Pasar a la siguiente fase (o jugador) después de fortificar (normalmente se termina turno aquí)
            // game.CurrentPhase = ???; // O llamar a EndTurn directamente? Depende de las reglas exactas.

            await NotifyGameStateUpdate(gameId, game);
            return (true, $"{request.ArmyCount} ejércitos movidos de {fromTerritory.Name} a {toTerritory.Name}.", game);
        }

        public async Task<(bool Success, string Message, Game? GameState)> EndTurnAsync(Guid gameId, string playerId)
        {
            if (!_activeGames.TryGetValue(gameId, out var game))
                return (false, "Partida no encontrada.", null);

            // --- Validaciones ---
            if (game.CurrentPlayerId != playerId) return (false, "No puedes terminar el turno de otro jugador.", game);
            // Se podría validar si está en fase de ataque o fortificación para terminar

            // --- Lógica de Fin de Turno ---
            int currentPlayerIndex = game.TurnOrder.FindIndex(pId => pId == playerId);
            if (currentPlayerIndex == -1) return (false, "Jugador no encontrado en el orden de turnos.", game);

            int nextPlayerIndex = (currentPlayerIndex + 1) % game.TurnOrder.Count;
            game.CurrentPlayerId = game.TurnOrder[nextPlayerIndex];
            game.CurrentPhase = GamePhase.Reinforcement; // El siguiente jugador empieza reforzando

            // TODO: Calcular refuerzos para el nuevo jugador.
            // TODO: Chequear condiciones de fin de juego.
            // TODO: Resetear flags (ej. si ya fortificó).

            await NotifyGameStateUpdate(gameId, game);
            return (true, $"Turno terminado. Es el turno de {game.Players.FirstOrDefault(p => p.Id == game.CurrentPlayerId)?.Name}.", game);
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
            if (startTerritoryId == endTerritoryId) return true; // Mismo territorio

            var visited = new HashSet<string>();
            var queue = new Queue<string>();

            visited.Add(startTerritoryId);
            queue.Enqueue(startTerritoryId);

            while (queue.Count > 0)
            {
                var currentId = queue.Dequeue();
                if (!game.Territories.TryGetValue(currentId, out var currentTerritory) || currentTerritory.OwnerPlayerId != playerId)
                    continue; // Ignorar si no existe o no es del jugador

                foreach (var neighborId in currentTerritory.AdjacentTerritoriesIds)
                {
                    if (neighborId == endTerritoryId) return true; // ¡Encontrado!

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

        private async Task NotifyGameStateUpdate(Guid gameId, Game game)
        {
            // Envía el estado completo del juego al grupo correspondiente
            await _hubContext.Clients.Group(gameId.ToString()).SendAsync("GameStateUpdated", game);
        }
    }
}