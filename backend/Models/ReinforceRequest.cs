namespace backend.Models{

    public class ReinforceRequest
    {
        public string PlayerId { get; set; } = "";
        public string TerritoryId { get; set; } = "";
        public int ArmyCount { get; set; }
    }
}