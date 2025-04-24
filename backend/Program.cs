using System.Text.Json.Serialization;
using backend.Hubs;
using backend.Models; // Necesario para los modelos
using backend.Services; // Necesario para el servicio
using Microsoft.AspNetCore.Mvc; // Para FromBody, etc.

var builder = WebApplication.CreateBuilder(args);

// --- Configuración de Servicios ---

builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options => // También para MVC/API Controllers si se usan internamente
{
     options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

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

try{
    var gameService = app.Services.GetRequiredService<IGameService>();
    Console.WriteLine("--- Creando partida por defecto ---");
    var defaultGame = await gameService.CreateNewGameAsync(null);
    if(defaultGame != null){
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("=======================================================");
        Console.WriteLine("  PARTIDA POR DEFECTO CREADA CON ÉXITO");
        Console.WriteLine($"  >> ID de la Partida: {defaultGame.Id} <<");
        Console.WriteLine("  Copia este ID y pégalo en el modal del frontend.");
        Console.WriteLine("=======================================================");
        Console.ResetColor();
    }
        else
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("!!! ERROR: No se pudo crear la partida por defecto.");
        Console.ResetColor();
    }
}
catch (Exception ex)
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"!!! EXCEPCIÓN al crear partida por defecto: {ex.Message}");
    Console.ResetColor();
}
// --- Configuración del Pipeline HTTP ---

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();        
    app.UseSwaggerUI();         
}

app.UseHttpsRedirection();
app.UseCors(MyAllowSpecificOrigins);
app.UseAuthorization();

// --- Definición de Endpoints (Minimal APIs) ---

app.MapPost("/api/games", async (IGameService gameService, [FromBody] List<Player>? initialPlayers) =>
{
    var newGame = await gameService.CreateNewGameAsync(initialPlayers);
    return Results.Created($"/api/games/{newGame.Id}", newGame);
})
.WithName("CreateGame") 
.WithTags("Game Management");

// GET /api/games/{gameId} ################################################################################################
app.MapGet("/api/games/{gameId}", async (Guid gameId, IGameService gameService) =>
{
    var game = await gameService.GetGameAsync(gameId);
    return game != null ? Results.Ok(game) : Results.NotFound();
})
.WithName("GetGame").WithTags("Game Management");

// POST /api/games/{gameId}/reinforce ################################################################################################
app.MapPost("/api/games/{gameId}/reinforce", async (Guid gameId, [FromBody] ReinforceRequest request, IGameService gameService) =>{
    var (success, message, gameState) = await gameService.ReinforceAsync(gameId,request);
    return success ? Results.Ok(new {message, gameState}) : Results.BadRequest(new {message});
}
).WithName("Reinforce").WithTags("Game Actions");

// POST /api/games/{gameId}/attack ################################################################################################
app.MapPost("/api/games/{gameId}/attack", async (Guid gameId, [FromBody] AttackRequest request, IGameService gameService) => {
    var result = await gameService.AttackAsync(gameId, request);
    return result.Success ? Results.Ok(result) : Results.BadRequest(result);
}).WithName("Attack").WithTags("Game Actions");

// POST /api/games/{gameId}/fortify ################################################################################################
app.MapPost("/api/games/{gameId}/fortify", async (Guid gameId, [FromBody] FortifyRequest request, IGameService gameService) => {
    var (success, message, gameState) = await gameService.FortifyAsync(gameId, request);
    return success ? Results.Ok(new {message, gameState}) : Results.BadRequest(new {message});
}).WithName("Fortify").WithTags("Game Actions");

 // POST /api/games/{gameId}/endturn ################################################################################################
app.MapPost("/api/games/{gameId}/endturn",
    async (Guid gameId, [FromBody] PlayerActionBase request, IGameService gameService) => // Usar un modelo base o simple
{
     var (success, message, gameState) = await gameService.EndTurnAsync(gameId, request.PlayerId);
     return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
})
.WithName("EndTurn").WithTags("Game Actions");

app.MapHub<GameHub>("/gamehub");


Console.WriteLine("--- Iniciando el servidor web... ---");

app.Run();