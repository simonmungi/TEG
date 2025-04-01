namespace backend.Models
{
    public class FortifyRequest
    {
        public string PlayerId { get; set; } = "";
        public string FromTerritoryId { get; set; } = "";
        public string ToTerritoryId { get; set; } = "";
        public int ArmyCount { get; set; } // Cuántos mover
    }
}