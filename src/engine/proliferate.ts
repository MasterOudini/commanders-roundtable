// D391 - proliferate (CR 701.27a): what may be chosen. ONE reader for the executor (the ask is
// raised only when something carries a counter), the answer handler (every pick is checked) and
// the fuzz driver (a random subset). Counters and poison are public, so the client and the bot
// list the same things off their VIEW, and the host's answer is the one that counts.
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState } from './types/state';

export interface ProliferateCandidates {
  readonly permanents: readonly InstanceId[];
  readonly players: readonly PlayerId[];
  /** Whether there is anything to choose at all - no candidates is no prompt (D137's rule). */
  readonly any: boolean;
}

export function proliferateCandidates(state: GameState): ProliferateCandidates {
  const permanents = state.zones.battlefield.filter((id) => {
    const card = state.cards[id];
    return card !== undefined && Object.values(card.counters).some((v) => v > 0);
  });
  // Poison is the only player counter this engine tracks (D68), and a player who has left the
  // game is never a candidate (CR 800.4a).
  const players = state.seating.filter((p) => {
    const ps = state.players[p];
    return ps !== undefined && !ps.hasLost && ps.poison > 0;
  });
  return { permanents, players, any: permanents.length + players.length > 0 };
}
