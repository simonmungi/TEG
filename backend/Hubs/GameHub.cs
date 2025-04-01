using Microsoft.AspNetCore.SignalR;

namespace backend.Hubs
{
    public class GameHub : Hub
    {
        public async Task JoinGameGroup(string gameId)
        {
            if (Guid.TryParse(gameId, out _)) // Validar que sea un Guid válido
            {
               await Groups.AddToGroupAsync(Context.ConnectionId, gameId);
               // Podrías notificar sólo a este cliente que se unió con éxito
               // await Clients.Caller.SendAsync("JoinedGame", gameId);
               // O incluso enviarle el estado actual del juego sólo a él al unirse
               // (Necesitarías acceso al GameService aquí, se puede inyectar)
            }
        }

        public async Task LeaveGameGroup(string gameId)
        {
             if (Guid.TryParse(gameId, out _))
             {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, gameId);
                // Podrías notificar que el jugador se fue
             }
        }

        // NOTA: No necesitamos métodos para enviar acciones desde el cliente aquí
        // porque estamos usando los Endpoints de la API para eso.
        // El Hub se usa principalmente para que el SERVIDOR envíe actualizaciones a los CLIENTES.
    }
}