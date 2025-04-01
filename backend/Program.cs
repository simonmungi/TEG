using backend.Models; // Necesario para los modelos
using backend.Services; // Necesario para el servicio
using Microsoft.AspNetCore.Mvc; // Para FromBody, etc.

var builder = WebApplication.CreateBuilder(args);

// --- Configuración de Servicios ---

builder.Services.AddEndpointsApiExplorer(); // Para que Swagger descubra los endpoints
builder.Services.AddSwaggerGen();          // Para generar la UI de Swagger

builder.Services.AddSingleton<IGameService, InMemoryGameService>();

var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: MyAllowSpecificOrigins,
                      policy =>
                      {
                          policy.WithOrigins("http://localhost:5173") // ¡IMPORTANTE! Cambia esto al puerto de tu frontend React
                                .AllowAnyHeader()
                                .AllowAnyMethod();
                          // Para SignalR necesitarás .AllowCredentials() más adelante
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

//app.UseAuthorization(); // Si añades autenticación/autorización más adelante


// --- Definición de Endpoints (Minimal APIs) ---

app.MapPost("/api/games", async (IGameService gameService, [FromBody] List<Player>? initialPlayers) =>
{
    // Validación básica de entrada
    if (initialPlayers == null || !initialPlayers.Any())
    {
        // Crear jugadores por defecto si no se proporcionan
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
    // Devolvemos la URL para obtener el juego creado y el propio juego
    return Results.Created($"/api/games/{newGame.Id}", newGame);
})
.WithName("CreateGame") // Nombre para Swagger
.WithTags("Game Management"); // Agrupación en Swagger

app.MapGet("/api/games/{gameId}", async (Guid gameId, IGameService gameService) =>
{
    var game = await gameService.GetGameAsync(gameId);
    return game != null ? Results.Ok(game) : Results.NotFound(); // Devuelve 200 OK con el juego o 404 Not Found
})
.WithName("GetGame")
.WithTags("Game Management");


// --- Ejecutar la aplicación ---
app.Run();