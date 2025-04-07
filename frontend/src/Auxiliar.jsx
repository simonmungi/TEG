<Card>
<CardContent>
  <GameInfo /* ... props ... */
    players={game.players}
    currentPlayerId={game.currentPlayerId}
    currentPhase={game.currentPhase}
    gameId={gameId} // Pasar ID si se quiere mostrar
  />
</CardContent>

</Card>


<Card>
<CardContent>
  <GameControls /* ... props ... */
    gamePhase={game.currentPhase}
    selectedTerritory={game.territories[selectedTerritoryId]}
    targetTerritory={game.territories[targetTerritoryId]}
    currentPlayerId={currentPlayerId}
    gamePlayerId={game.currentPlayerId}
    onReinforce={handleReinforce}
    onAttack={handleAttack}
    onFortify={handleFortify}
    onEndTurn={handleEndTurn}
    onCancel={() => { setSelectedTerritoryId(null); setTargetTerritoryId(null); }}
  />
</CardContent>
</Card>