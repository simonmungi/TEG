using System.Drawing;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
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
            PrintSuccessMessage(defaultGame);
            PrintCurrentTurn(defaultGame);
            PrintCommands(defaultGame, gameService);
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

static void PrintSuccessMessage(Game game)
{
    Console.ForegroundColor = ConsoleColor.Cyan;
    Console.WriteLine("=======================================================");
    Console.WriteLine("  PARTIDA POR DEFECTO CREADA CON ÉXITO");
    Console.WriteLine($"  >> ID de la Partida: {game.Id} <<");
    Console.WriteLine("  Copia este ID y pégalo en el modal del frontend.");
    Console.WriteLine("=======================================================");
}

static void PrintCurrentTurn(Game game)
{
    Console.ForegroundColor = (ConsoleColor)Enum.Parse(typeof(ConsoleColor), GetColor(game), true);
    Console.WriteLine($"  >> Turno de: {game.CurrentPlayerId}");
    Console.WriteLine($"  >> Fase: {game.CurrentPhase}");
    Console.WriteLine("=======================================================");
}

static void PrintCommands(Game game, IGameService gameService)
{
    while (true)
    {
        Console.ForegroundColor = (ConsoleColor)Enum.Parse(typeof(ConsoleColor), GetColor(game), true);
        Console.Write($" >>");
        string input = Console.ReadLine()?.Trim().ToLower();

        if (string.IsNullOrEmpty(input))
            continue;

        if (input.Equals("exit", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("Exiting");
            break;
        }

        ProcessCommand(game, input, gameService);
    }
}

static void ProcessCommand(Game game, string input, IGameService gameService)
{
    var parts = input.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    if (parts.Length == 0)
        return;

    string command = parts[0];
    string[] arguments = parts.Skip(1).ToArray();

    switch (command)
    {
        case "fortify":
            break;
        case "list":
            ViewArmies(game);
            break;
        case "attack":
            ViewAttackList(game, gameService);
            break;
        case "end":
            break;
        default:
            Console.WriteLine($" >>'{command}' no es un comando valido.");
            break;
    }
}

static void ViewArmies(Game game)
{
    var currentPlayer = game.Players.Where(x => x.Id == game.CurrentPlayerId).FirstOrDefault();
    var playerTerritories = game.Territories.Where(x => x.Value.OwnerPlayerId == currentPlayer.Id).OrderBy(x => x.Value.Name).ToList();
    PrintTerritories(playerTerritories);
}

static void PrintTerritories(IEnumerable<KeyValuePair<string, Territory>> territories)
{
    foreach (var kv in territories)
    {
        var name = kv.Value?.Name?.Trim();
        if (string.IsNullOrEmpty(name)) continue;

        if (name.StartsWith("path", StringComparison.OrdinalIgnoreCase)) continue;

        Console.WriteLine($"  - {name}: {kv.Value.Armies}");
    }
}


static async Task ViewAttackList(Game game, IGameService gameService)
{
    var currentPlayer = game.Players.FirstOrDefault(x => x.Id == game.CurrentPlayerId);
    if (currentPlayer == null)
    {
        Console.WriteLine("Jugador actual no encontrado.");
        return;
    }

    var playerTerritories = game.Territories
        .Where(x => x.Value.OwnerPlayerId == currentPlayer.Id && x.Value.Clickable)
        .ToList();

    var attackableTerritoriesIds = playerTerritories
        .SelectMany(t => t.Value.AdjacentTerritoriesIds ?? Enumerable.Empty<string>())
        .Distinct()
        .ToHashSet();

    var attackableTerritories = game.Territories
        .Where(x => attackableTerritoriesIds.Contains(x.Value.Id))
        .OrderBy(x => x.Value.Name)
        .ToList();

    Console.WriteLine("=======================================================");
    Console.WriteLine("Territorios atacables:");
    PrintTerritories(attackableTerritories);

    Console.Write($" >> Seleccione un país a atacar: ");
    while (true)
    {
        string input = Console.ReadLine()?.Trim();
        if (string.IsNullOrEmpty(input))
        {
            Console.Write($" >> Seleccione un país a atacar: ");
            continue;
        }

        if (input.Equals("cancel", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine(" >> Ataque cancelado.");
            return;
        }

        var countryToAttackName = input.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];

        var countryToAttack = FindTerritoryByName(game.Territories, countryToAttackName);
        if (countryToAttack.Value == null)
        {
            Console.WriteLine("Pais no encontrado");
            continue;
        }

        var canAttackFrom = playerTerritories
            .Where(t => (countryToAttack.Value.AdjacentTerritoriesIds ?? Enumerable.Empty<string>())
                .Contains(t.Value.Id))
            .ToList();

        Console.WriteLine(">> Atacar desde: ");
        PrintTerritories(canAttackFrom);

        string attacFromInput = Console.ReadLine()?.Trim();
        if (string.IsNullOrEmpty(attacFromInput))
        {
            Console.WriteLine(">> País no encontrado.");
            continue;
        }

        var found = canAttackFrom.Any(t =>
            string.Equals(t.Value.Name?.Trim(), attacFromInput, StringComparison.OrdinalIgnoreCase));

        if (!found)
        {
            Console.WriteLine(">> País no encontrado.");
            continue;
        }

        var attackingCountry = FindTerritoryByName(game.Territories, attacFromInput);
        if (attackingCountry.Value == null)
        {
            Console.WriteLine("Pais no encontrado");
            continue;
        }

        Console.WriteLine($"INICIANDO ATAQUE DESDE {attacFromInput.ToUpper()} A {countryToAttackName.ToUpper()}");

        var AttackRequest = new AttackRequest
        {
            PlayerId = game.CurrentPlayerId,
            AttackingTerritoryId = countryToAttack.Key,
            DefendingTerritoryId = attackingCountry.Key,
            AttackingArmies = attackingCountry.Value.Armies - 1
        };

        var result = await gameService.AttackAsync(game.Id, AttackRequest);
        if (result != null)
        {
            Console.WriteLine(result.ToString());
        }
        return;
    }
}

static KeyValuePair<string, Territory>? TryFindTerritoryByName(
    IEnumerable<KeyValuePair<string, Territory>> territories,
    string name)
{
    if (string.IsNullOrWhiteSpace(name))
        return null;

    return territories.FirstOrDefault(kv => string.Equals(kv.Value?.Name?.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase));
}

static KeyValuePair<string, Territory> FindTerritoryByName(
    IEnumerable<KeyValuePair<string, Territory>> territories,
    string name)
{
    return territories
        .FirstOrDefault(kv => string.Equals(kv.Value?.Name?.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase));
}

static string GetColor(Game game)
{
    var colorName = game.Players.Find(x => x.Id == game.CurrentPlayerId).Color;
    return colorName;
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