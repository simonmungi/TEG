
namespace backend.Models.RequestsDTOs
{
    public class CommitReinforcementsRequest
    {
        public string PlayerId { get; set; } = ""; // Quién confirma
        public List<ReinforcementPlacementDto> Placements { get; set; } = new List<ReinforcementPlacementDto>();
    }
}