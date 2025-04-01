namespace backend.Models
{
    public class FortifyRequest
    {
        public string PlayerId { get; set; } = ""
        public string FromTerritoryId { get; set; } = ""
        public string TerritoryId { get; set; } = ""
        public int ArmyCount { get; set; }
    }
}