// D527 - CLASH (CR 701, the clash rule). "Clash with an opponent": you and the opponent each reveal the top card of your library,
// then each puts that card on the top or bottom of their library; you win the clash when your card's mana value is
// higher than theirs. A player with an empty library reveals nothing and cannot win; a tie wins nothing. The two
// placements are two scry prompts, chained (the explore's shape, D409): yours first, then the opponent's, each carrying
// the clash so far (`ClashState`); the verdict is the `Clashed` marker - the trigger heads' event and the fuzz's count
// - and it rides the resolution's continuation so `If you win, ...` (a gated clause, D523) can read it. One opponent is
// forced; more are asked for (`Awaiting.choosePlayer`); none narrates.

import { derive } from './derive';
import type { EngineDeps } from './loop';
import { n, narrated, vb, who, whose } from './narrate';
import type { EventBody } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { ClashState, GameState } from './types/state';

/** The opponents still in the game, in seating order: the candidates for `Clash with an opponent`. */
export function clashOpponents(state: GameState, player: PlayerId): PlayerId[] {
  return state.seating.filter((p) => p !== player && state.players[p]?.hasLost !== true);
}

/** The top card of a player's library and its mana value; nothing, and a value below every card's, with an empty library. */
function topOf(state: GameState, deps: EngineDeps, player: PlayerId): { readonly card: InstanceId | null; readonly mv: number } {
  const lib = state.zones.library[player] ?? [];
  const card = lib[lib.length - 1];
  if (card === undefined) return { card: null, mv: -1 };
  const inst = state.cards[card];
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  return { card, mv: printing ? printing.manaValue : 0 };
}

/** Your reveal and your placement question; with nothing to reveal, straight to the opponent's step. */
export function clashBegin(state: GameState, deps: EngineDeps, you: PlayerId, opponent: PlayerId, label: string): EventBody[] {
  const out: EventBody[] = [];
  const top = topOf(state, deps, you);
  if (top.card === null) {
    out.push(narrated(n`${who(state, you)} ${vb(you, 'clashes', 'clash')} with ${who(state, opponent)}: ${whose(state, you)} library is empty, so nothing is revealed.`, you));
    out.push(...clashOpponentStep(state, deps, { stage: 'you', you, opponent, yourMv: -1 }, label));
    return out;
  }
  const name = derive(state, deps.oracle, deps.scripts, top.card).name;
  out.push({ t: 'CardsRevealed', cards: [top.card], to: [...state.seating] });
  out.push(narrated(n`${who(state, you)} ${vb(you, 'clashes', 'clash')} with ${who(state, opponent)} and ${vb(you, 'reveals', 'reveal')} ${name} (mana value ${top.mv}).`, you));
  out.push({
    t: 'AwaitingSet',
    awaiting: { kind: 'scryChoice', player: you, count: 1, toGraveyard: false, thenDraw: 0, label, clash: { stage: 'you', you, opponent, yourMv: top.mv } },
  });
  return out;
}

/** The opponent's reveal and placement question; with nothing to reveal, the verdict at once. */
export function clashOpponentStep(state: GameState, deps: EngineDeps, clash: ClashState, label: string): EventBody[] {
  const out: EventBody[] = [];
  const top = topOf(state, deps, clash.opponent);
  if (top.card === null) {
    out.push(narrated(n`${whose(state, clash.opponent)} library is empty, so nothing is revealed.`, clash.opponent));
    out.push(...clashFinish(state, { ...clash, stage: 'opponent', theirMv: -1 }, label));
    return out;
  }
  const name = derive(state, deps.oracle, deps.scripts, top.card).name;
  out.push({ t: 'CardsRevealed', cards: [top.card], to: [...state.seating] });
  out.push(narrated(n`${who(state, clash.opponent)} ${vb(clash.opponent, 'reveals', 'reveal')} ${name} (mana value ${top.mv}).`, clash.opponent));
  out.push({
    t: 'AwaitingSet',
    awaiting: {
      kind: 'scryChoice',
      player: clash.opponent,
      count: 1,
      toGraveyard: false,
      thenDraw: 0,
      label,
      clash: { stage: 'opponent', you: clash.you, opponent: clash.opponent, yourMv: clash.yourMv, theirMv: top.mv },
    },
  });
  return out;
}

/** The verdict: the marker and its narration. Won only with the strictly higher mana value (CR 701.10b). */
export function clashFinish(state: GameState, clash: ClashState, label: string): EventBody[] {
  const theirMv = clash.theirMv ?? -1;
  const won = clash.yourMv > theirMv;
  return [
    { t: 'Clashed', player: clash.you, opponent: clash.opponent, won, yourMv: clash.yourMv, theirMv },
    narrated(n`${label}: ${who(state, clash.you)} ${won ? vb(clash.you, 'wins', 'win') : vb(clash.you, 'loses', 'lose')} the clash (${clash.yourMv} against ${theirMv}).`, clash.you),
  ];
}
