
namespace backend.Models{

    public class Territory{
        public string Id { get; set; }="";
        public string Name { get; set; }="";
        public string? OwnerPlayerId { get; set; }
        public int Armies { get; set; }
        public List<string> AdjacentTerritoriesIds { get; set; } = new List<string>();
        public string PathData { get; set; } = "";
    }
}