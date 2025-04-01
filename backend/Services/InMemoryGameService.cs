using System.Collections.Concurrent;
using backend.Models;

namespace backend.Services
{

    public class InMemoryGameService : IGameService
    {
        private static readonly ConcurrentDictionary<Guid, Game> _activeGames = new ConcurrentDictionary<Guid, Game>();

        public async Task<Game> CreateNewGameAsync(List<Player> initialPlayers)
        {
            var newGame = new Game{
                Players = initialPlayers ?? new List<Player>()
            };

            InitializeMap(newGame);
            AssignInitialTerritories(newGame);
            SetupTurnOrder(newGame);

            newGame.CurrentPhase = newGame.Players.Any() ? GamePhase.Reinforcement : GamePhase.WaitingForPlayers;
            newGame.CurrentPlayerId = newGame.TurnOrder.FirstOrDefault();

            _activeGames.TryAdd(newGame.Id, newGame);

            //await NotifyGameStateUpdate(newGame.Id, newGame);

            return newGame;
        }

        public Task<Game?> GetGameAsync(Guid gameId)
        {
            throw new NotImplementedException();
        }

        private void InitializeMap(Game game){
                        var territories = new List<Territory>
            {
                new Territory { Id = "arg", Name = "Argentina", AdjacentTerritoriesIds = new List<string> { "bra", "chi" } },
                new Territory { Id = "bra", Name = "Brasil", AdjacentTerritoriesIds = new List<string> { "arg", "per" } },
                new Territory { Id = "chi", Name = "Chile", AdjacentTerritoriesIds = new List<string> { "arg", "per" } },
                new Territory { Id = "per", Name = "Peru", AdjacentTerritoriesIds = new List<string> { "bra", "chi" } }
            };

            foreach(var t in territories){
                game.Territories.Add(t.Id, t);
            }
        }

        private void AssignInitialTerritories(Game game){
            if(!game.Players.Any()) return;

            var territoryIds = game.Territories.Keys.ToList();
            var random = new Random();
            territoryIds = territoryIds.OrderBy(t => random.Next()).ToList();

            int playerIndex = 0;
            foreach(var territoryId in territoryIds){
                var territory = game.Territories[territoryId];
                var owner = game.Players[playerIndex % game.Players.Count];
                territory.OwnerPlayerId = owner.Id;
                territory.Armies = 1;
                playerIndex++;
            }
        }

        private void SetupTurnOrder(Game game){
            var random = new Random();
            game.TurnOrder = game.Players.Select(p => p.Id).OrderBy(id => random.Next()).ToList();
        }

        public async Task<(bool Success, string Message, Game? GameState)> ReinforceAsync(Guid gameId, ReinforceRequest request)
        {
            if(!_activeGames.TryGetValue(gameId, out var game)) return (false, "Partida no encontrada", null);

            if (game.CurrentPlayerId != request.PlayerId) return (false, "No es tu turno.", game);
            if (game.CurrentPhase != GamePhase.Reinforcement) return (false, "No estás en la fase de refuerzo.", game);
            if (!game.Territories.TryGetValue(request.TerritoryId, out var territory)) return (false, "Territorio no encontrado.", game);
            if (territory.OwnerPlayerId != request.PlayerId) return (false, "No puedes reforzar un territorio que no te pertenece.", game);
            if (request.ArmyCount <= 0) return (false, "Debes reforzar con al menos 1 ejército.", game);

            // TODO: Implementar lógica real de cálculo de refuerzos (ej. basado en territorios, continentes, cartas)
            // Por ahora, asumamos que el jugador tiene 'X' refuerzos disponibles y los gasta.
            // Esta validación es crucial y falta aquí.

            territory.Armies += request.ArmyCount;

            //await NotifyGameStateUpdate(gameId, game);

            return (true, $"{request.ArmyCount} ejércitos añadidos a {territory.Name}.", game);
        }

        public async Task<AttackResult> AttackAsync(Guid gameId, AttackRequest request)
        {
            var result = new AttackResult {Success = false};

            if(!_activeGames.TryGetValue(gameId, out var game)){
                result.Message = "Partida no encontrada.";
                return result;
            }
            result.UpdatedGameState = game;

            // -- validaciones --
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
            int attackerDiceCount = Math.Min(request.AttackingArmies, 3);
            int defenderDiceCount = Math.Min(request.AttackingArmies, 2);

            result.AttackerDiceRolls = RollDice(attackerDiceCount);
            result.DefenderDiceRolls = RollDice(defenderDiceCount);

            result.AttackerDiceRolls.Sort((a,b) => b.CompareTo(a));
            result.DefenderDiceRolls.Sort((a,b) => b.CompareTo(a));

            int pairsToCompare = Math.Min(attackerDiceCount, defenderDiceCount);
            result.AttackerLosses = 0;
            result.DefenderLosses = 0;

            for(int i = 0; i< pairsToCompare; i++){
                if(result.AttackerDiceRolls[i] > result.DefenderDiceRolls[i]) result.DefenderLosses ++;
                else result.AttackerLosses++;
            }

            attackerTerritory.Armies -= result.AttackerLosses;
            defenderTerritory.Armies -= result.AttackerLosses;

            // --- Chequear conquista ---
            if(defenderTerritory.Armies <= 0){
                result.TerritoryConquered = true;
                defenderTerritory.OwnerPlayerId = request.PlayerId;

                int armiesToMove = Math.Max(1, request)
            }
        }

        public async Task<(bool Success, string Message, Game? GameState)> FortifyAsync(Guid gameId, FortifyRequest request)
        {
            throw new NotImplementedException();
        }

        public async Task<(bool Success, string Message, Game? GameState)> EndTurnAsync(Guid gameId, string playerId)
        {
            throw new NotImplementedException();
        }
    }
}