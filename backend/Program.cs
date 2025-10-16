using System.Text.Json.Serialization;
using backend.Hubs;
using backend.Models;
using backend.Models.RequestsDTOs;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

const string CORS_POLICY_NAME = "_myAllowSpecificOrigins";
const string FRONTEND_URL = "http://localhost:5173";

var builder = WebApplication.CreateBuilder(args);

ConfigureServices(builder.Services);

var app = builder.Build();

await InitializeDefaultGameAsync(app);
ConfigureMiddleware(app);
ConfigureEndpoints(app);

Console.WriteLine("--- Iniciando el servidor web... ---");
app.Run();

static void ConfigureServices(IServiceCollection services)
{
    services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    services.AddEndpointsApiExplorer();
    services.AddSwaggerGen();

    services.AddSingleton<IGameService, InMemoryGameService>();

    services.AddSignalR().AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    services.AddCors(options =>
    {
        options.AddPolicy(name: CORS_POLICY_NAME, policy =>
        {
            policy.WithOrigins(FRONTEND_URL)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    });
}

static async Task InitializeDefaultGameAsync(WebApplication app)
{
    try
    {
        var gameService = app.Services.GetRequiredService<IGameService>();
        Console.WriteLine("--- Creando partida por defecto ---");
        
        var defaultGame = await gameService.CreateNewGameAsync(null);
        if (defaultGame != null)
        {
            PrintSuccessMessage(defaultGame.Id);
        }
        else
        {
            PrintErrorMessage("No se pudo crear la partida por defecto.");
        }
    }
    catch (Exception ex)
    {
        PrintErrorMessage($"EXCEPCIÓN al crear partida por defecto: {ex.Message}");
    }
}

static void PrintSuccessMessage(Guid gameId)
{
    Console.ForegroundColor = ConsoleColor.Cyan;
    Console.WriteLine("=======================================================");
    Console.WriteLine("  PARTIDA POR DEFECTO CREADA CON ÉXITO");
    Console.WriteLine($"  >> ID de la Partida: {gameId} <<");
    Console.WriteLine("  Copia este ID y pégalo en el modal del frontend.");
    Console.WriteLine("=======================================================");
    Console.ResetColor();
}

static void PrintErrorMessage(string message)
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"!!! ERROR: {message}");
    Console.ResetColor();
}

static void ConfigureMiddleware(WebApplication app)
{
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseHttpsRedirection();
    app.UseCors(CORS_POLICY_NAME);
    app.UseAuthorization();
}

static void ConfigureEndpoints(WebApplication app)
{
    app.MapPost("/api/games", async (IGameService gameService, [FromBody] List<Player>? initialPlayers) =>
    {
        var newGame = await gameService.CreateNewGameAsync(initialPlayers);
        return Results.Created($"/api/games/{newGame.Id}", newGame);
    })
    .WithName("CreateGame")
    .WithTags("Game Management");

    app.MapGet("/api/games/{gameId}", async (Guid gameId, IGameService gameService) =>
    {
        var game = await gameService.GetGameAsync(gameId);
        return game != null ? Results.Ok(game) : Results.NotFound();
    })
    .WithName("GetGame")
    .WithTags("Game Management");
    //----------------------------------------------------------------------------------------------------------------------------------------
    app.MapPost("/api/games/{gameId}/reinforce", async (Guid gameId, [FromBody] ReinforceRequest request, IGameService gameService) =>
    {
        var (success, message, gameState) = await gameService.ReinforceAsync(gameId, request);
        return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
    })
    .WithName("Reinforce")
    .WithTags("Game Actions");

    app.MapPost("/api/games/{gameId}/attack", async (Guid gameId, [FromBody] AttackRequest request, IGameService gameService) =>
    {
        var result = await gameService.AttackAsync(gameId, request);
        return result.Success ? Results.Ok(result) : Results.BadRequest(result);
    })
    .WithName("Attack")
    .WithTags("Game Actions");

    app.MapPost("/api/games/{gameId}/fortify", async (Guid gameId, [FromBody] FortifyRequest request, IGameService gameService) =>
    {
        var (success, message, gameState) = await gameService.FortifyAsync(gameId, request);
        return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
    })
    .WithName("Fortify")
    .WithTags("Game Actions");

    app.MapPost("/api/games/{gameId}/endturn", async (Guid gameId, [FromBody] PlayerActionBase request, IGameService gameService) =>
    {
        var (success, message, gameState) = await gameService.EndTurnAsync(gameId, request.PlayerId);
        return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
    })
    .WithName("EndTurn")
    .WithTags("Game Actions");

    app.MapPost("/api/games/{gameId}/reinforcements/commit", async (Guid gameId, [FromBody] CommitReinforcementsRequest request, IGameService gameService) =>
    {
        var (success, message, gameState) = await gameService.CommitReinforcementsAsync(gameId, request.PlayerId, request.Placements);
        return success ? Results.Ok(new { message, gameState }) : Results.BadRequest(new { message });
    })
    .WithName("CommitReinforcements")
    .WithTags("Game Actions");
    //----------------------------------------------------------------------------------------------------------------------------------------

    app.MapHub<GameHub>("/gamehub");
}