// D554 - GOAD (CR 701.15a/b): "Until your next turn, that creature attacks each combat if able and attacks a player
// other than you if able." Several players may goad one creature: the mark is a list (`CardInstance.goadedBy`, joined by
// the `Goaded` event, each goader pruned as that player's next turn begins, cleared as the creature leaves). These are
// the one reading the requirement (`requiredAttackers`), the defender rule (the declaration's host check) and the prompt
// all ask (D139). A goader who has left the game goads nothing: that player has no next turn to wait for.
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState } from './types/state';

/** The players whose goad still binds this creature. */
export function goadersOf(state: GameState, id: InstanceId): readonly PlayerId[] {
  const by = state.cards[id]?.goadedBy;
  return by === undefined ? [] : by.filter((p) => state.players[p]?.hasLost !== true);
}

export function isGoaded(state: GameState, id: InstanceId): boolean {
  return goadersOf(state, id).length > 0;
}
