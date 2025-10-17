namespace backend.Models
{
    public class AttackRequest
    {
        public string PlayerId { get; set; } = "";
        public string AttackingTerritoryId { get; set; } = "";
        public string DefendingTerritoryId { get; set; } = "";
        public int AttackingArmies { get; set; } // Cuántos ejércitos USAR en el ataque (no necesariamente todos los del territorio)
    }

    public class AttackResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        public List<int> AttackerDiceRolls { get; set; } = new List<int>();
        public List<int> DefenderDiceRolls { get; set; } = new List<int>();
        public int AttackerLosses { get; set; }
        public int DefenderLosses { get; set; }
        public bool TerritoryConquered { get; set; } = false;
        public Game? UpdatedGameState { get; set; }

        public override string ToString()
        {
            var attackerDice = AttackerDiceRolls.Count > 0 ? string.Join(", ", AttackerDiceRolls) : "None";
            var defenderDice = DefenderDiceRolls.Count > 0 ? string.Join(", ", DefenderDiceRolls) : "None";

            return $@"Attack Result:
            Success: {Success}
            Message: {Message}
            Attacker Dice Rolls: {attackerDice}
            Defender Dice Rolls: {defenderDice}
            Attacker Losses: {AttackerLosses}
            Defender Losses: {DefenderLosses}
            Territory Conquered: {TerritoryConquered}";
        }
    }

}