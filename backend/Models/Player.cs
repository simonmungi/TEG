namespace backend.Models{

    public class Player{
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "Anon";
        public string Color { get; set; } = "#FFFFF";
    }
}