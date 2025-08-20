namespace backend.Models
{
    public class Game
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public List<Player> Players { get; set; } = new List<Player>();
        public Dictionary<string, Territory> Territories { get; set; } = new Dictionary<string, Territory>();
        public string? CurrentPlayerId { get; set; }
        public GamePhase CurrentPhase { get; set; } = GamePhase.WaitingForPlayers;
        public List<string> TurnOrder { get; set; } = new List<string>();
        public int PendingReinforcements { get; set; }
    }
    
    public enum GamePhase{
        WaitingForPlayers,
        Reinforcement,
        Attack,
        Fortification,
        GameOver
    }
}