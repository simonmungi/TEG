using backend.Hubs;
using backend.Models; // Necesario para los modelos
using backend.Services; // Necesario para el servicio
using Microsoft.AspNetCore.Mvc; // Para FromBody, etc.

var builder = WebApplication.CreateBuilder(args);

// --- Configuración de Servicios ---

builder.Services.AddEndpointsApiExplorer(); // Para que Swagger descubra los endpoints
builder.Services.AddSwaggerGen();          // Para generar la UI de Swagger

builder.Services.AddSingleton<IGameService, InMemoryGameService>();
builder.Services.AddSignalR();

var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: MyAllowSpecificOrigins,
                      policy =>
                      {
                          policy.WithOrigins("http://localhost:5173") // Puerto del Frontend React
                                .AllowAnyHeader()
                                .AllowAnyMethod()
                                .AllowCredentials(); // IMPORTANTE para SignalR si usa autenticación/cookies
                      });
});


var app = builder.Build();

// --- Configuración del Pipeline HTTP ---

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();           // Habilita el middleware de Swagger
    app.UseSwaggerUI();         // Habilita la UI de Swagger en /swagger
}

app.UseHttpsRedirection();
app.UseCors(MyAllowSpecificOrigins);
app.UseAuthorization();

//app.UseAuthorization(); // Si añades autenticación/autorización más adelante


// --- Definición de Endpoints (Minimal APIs) ---

app.MapPost("/api/games", async (IGameService gameService, [FromBody] List<Player>? initialPlayers) =>
{
    if (initialPlayers == null || !initialPlayers.Any())
    {
        initialPlayers = new List<Player>
        {
            new Player { Name = "Jugador 1", Color = "#a7c7e7" },
            new Player { Name = "Jugador 2", Color = "#f5cba7" }
        };
    } else {
        // Asignar IDs si no vienen
        foreach (var p in initialPlayers.Where(p => string.IsNullOrEmpty(p.Id)))
        {
            p.Id = Guid.NewGuid().ToString();
        }
    }


    var newGame = await gameService.CreateNewGameAsync(initialPlayers);
    return Results.Created($"/api/games/{newGame.Id}", newGame);
})
.WithName("CreateGame") // Nombre para Swagger
.WithTags("Game Management"); // Agrupación en Swagger

app.MapGet("/api/games/{gameId}", async (Guid gameId, IGameService gameService) =>
{
    var game = await gameService.GetGameAsync(gameId);
    return game != null ? Results.Ok(game) : Results.NotFound();
})
.WithName("GetGame")
.WithTags("Game Management");

// POST /api/games/{gameId}/reinforce
app.MapPost("/api/games/{gameId}/reinforce", async (Guid gameId, [FromBody] ReinforceRequest request, IGameService gameService) =>{
    var (success, message, gameState) = await gameService.ReinforceAsync(gameId,request);
    return success ? Results.Ok(new {message, gameState}) : Results.BadRequest(new {message});
}
).WithName("Reinforce").WithTags("Game Actions");

// POST /api/games/{gameId}/attack
app.MapPost("/api/games/{gameId}/attack", async (Guid gameId, [FromBody] AttackRequest request, IGameService gameService) => {
    var result = await gameService.AttackAsync(gameId, request);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
}).WithName("Attack").WithTags("Game Actions");

// POST /api/games/{gameId}/fortify
app.MapPost("/api/games/{gameId}/fortify", async (Guid gameId, [FromBody] FortifyRequest request, IGameService gameService) => {
    var (success, message, gameState) = await gameService.FortifyAsync(gameId, request);
    return success ? Results.Ok(new {message, gameState}) : Results.BadRequest(new {message});
}).WithName("Fortify").WithTags("Game Actions");

 // POST /api/games/{gameId}/endturn
app.MapPost("/api/games/{gameId}/endturn",
    async (Guid gameId, [FromBody] PlayerActionBase request, IGameService gameService) => // Usar un modelo base o simple
{
     var (success, message, gameState) = await gameService.EndTurnAsync(gameId, request.PlayerId);
     return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
})
.WithName("EndTurn").WithTags("Game Actions");

app.MapHub<GameHub>("/gamehub");

app.Run();