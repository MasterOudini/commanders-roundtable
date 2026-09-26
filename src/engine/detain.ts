// D552 - DETAIN (CR 701.35a): "Until your next turn, that permanent can't attack or block and its activated abilities
// can't be activated." The mark is the card's (`CardInstance.detainedBy`, set by the `Detained` event, cleared as the
// detaining player's next turn begins and as the permanent leaves the battlefield); this is the one predicate the attack
// and block checks, the activation offer and host, and the mana sources all ask (D139). A mark whose detaining player
// has left the game ends with them: that player has no next turn to wait for.
import type { InstanceId } from './types/ids';
import type { GameState } from './types/state';

export function isDetained(state: GameState, id: InstanceId): boolean {
  const by = state.cards[id]?.detainedBy;
  return by !== undefined && state.players[by]?.hasLost !== true;
}
