using backend.Models;
using backend.Models.RequestsDTOs;

namespace backend.Services{
    public interface IGameService
    {
        Task<Game> CreateNewGameAsync(List<Player> players);
        Task<Game?> GetGameAsync(Guid gameId);
        Task<(bool Success, string Message, Game? GameState)> ReinforceAsync(Guid gameId, ReinforceRequest request);
        Task<AttackResult> AttackAsync(Guid gameId, AttackRequest request);
        Task<(bool Success, string Message, Game? GameState)> FortifyAsync(Guid gameId, FortifyRequest request);
        Task<(bool Success, string Message, Game? GameState)> EndTurnAsync(Guid gameId, string playerId); // Quien termina el turno
        Task<(bool Success, string Message, Game? GameState)> CommitReinforcementsAsync(Guid gameId, string playerId, List<ReinforcementPlacementDto> placements);
    }
}