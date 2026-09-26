// D549 - MYRIAD (CR 702.116a): "Whenever this creature attacks, for each opponent other than the defending player, you may
// create a token that's a copy of this creature that's tapped and attacking that player or a planeswalker they control.
// If one or more tokens are created this way, exile the tokens at end of combat." A Tier-2 keyword whose keyword-table
// entry resolves mobilize's shape with D485's copy and D497's end-of-combat delay; the may is asked once for every other
// opponent. What is proven here: the keyword and its line accounted; three seats - p1 attacks p2, accepts, and a token
// copy attacks p3, tapped, and is exiled at end of combat; declined - no token; two seats - there is no other opponent,
// and nothing triggers; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const NAME = "Wyrm's Crossing Patrol";
const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const tokensOf = (g: Game) => (Object.keys(g.state.cards) as InstanceId[]).filter((id) => g.state.cards[id]?.isToken === true);

/** `players` seats; p1's myriad creature attacks p2 on p1's second turn; the myriad trigger answered `accept` (if asked). */
function attacked(players: 2 | 3, accept: boolean): { g: Game; patrol: InstanceId; asked: boolean } {
  const decks = [[NAME, ...LANDS], [...LANDS], [...LANDS]].slice(0, players);
  const g = startedGame({ players, decks });
  holdEverywhere(g);
  const patrol = put(g, 'p1', NAME);
  const turn = players + 1;
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: patrol, defender: { kind: 'player', id: 'p2' } }] }));
  let asked = false;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger' || (s.turn.step !== 'declareAttackers' && s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
  const offer = g.state.priority.awaiting;
  if (offer?.kind === 'optionalTrigger') {
    asked = true;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: offer.stackId, accept }));
  }
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
  return { g, patrol, asked };
}

describe('D549 - myriad', () => {
  test('the keyword and its line: myriad is Tier 2, the Myriad line the engine\'s', () => {
    const face = faceNamed(NAME);
    expect(face.keywords).toContain('myriad');
    const card = ENGINE_CARDS.find((c) => c.name === NAME);
    const printed = card?.faces[0];
    if (!card || !printed) throw new Error('no fixture');
    expect(linesUnaccounted(printed.oracleText, face, card.keywords).map((l) => l.text)).toEqual([]);
  });

  test('three seats, accepted: a token copy tapped and attacking the other opponent, exiled at end of combat', () => {
    const { g, patrol, asked } = attacked(3, true);
    expect(asked, 'the may is asked').toBe(true);
    const made = tokensOf(g).filter((id) => g.state.cards[id]?.zone.kind === 'battlefield');
    expect(made).toHaveLength(1);
    const token = made[0] as InstanceId;
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, token).name).toBe(NAME);
    expect(g.state.cards[token]?.tapped).toBe(true);
    const attack = g.state.combat?.attackers.find((a) => a.card === token);
    expect(attack?.defender, 'attacking the player other than the defending one').toEqual({ kind: 'player', id: 'p3' });
    expect(g.state.combat?.attackers.find((a) => a.card === patrol)?.defender).toEqual({ kind: 'player', id: 'p2' });
    advanceUntil(g, (s) => s.turn.step === 'postcombatMain' || s.turn.phase === 'postcombatMain', 40_000);
    expect(g.state.cards[token]?.zone.kind === 'battlefield', 'exiled at end of combat').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('three seats, declined: no token', () => {
    const { g, asked } = attacked(3, false);
    expect(asked).toBe(true);
    expect(tokensOf(g)).toHaveLength(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two seats: no other opponent, nothing triggers', () => {
    const { g, asked } = attacked(2, true);
    expect(asked, 'no prompt').toBe(false);
    expect(tokensOf(g)).toHaveLength(0);
    expect(g.log.some((e) => e.body.t === 'PendingTriggersAdded' && e.body.triggers.some((t) => t.label.endsWith('myriad')))).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
