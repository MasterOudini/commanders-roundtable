// D473 - THE QUOTED TOKEN. A card that makes a token whose rules text is not a keyword prints that
// text in quotes - `Create two 1/1 colorless Eldrazi Scion creature tokens. They have "Sacrifice this
// token: Add {C}."` - and `scrub` blanked the quote before the token parser ever saw it, so every
// such description was refused as a token with a run of spaces where its ability was. The quote is
// the PRINTING'S OWN TEXT: `foldTokenQuotes` lifts it out before the scrub, the parser reads it back
// through a mark, `TOKEN_TABLE` keys it (`|q=...`), and `matchToken` compares it to the printing
// exactly (the self-reference read as one word: the printing says `this creature` where the card quotes
// `this token`, CR 111.4). What is proven here, end to end:
//   - the sorcery resolves BY ITSELF (no script) and puts two real Eldrazi Scions down, named;
//   - the Scion's own mana ability runs as printed - a sacrifice for {C}, charged by D325's rule;
//   - the replay hash.
import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { Game } from './game';
import { replay, stateHash } from './log';
import { manaSourcesOf } from './mana';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, battlefieldOf, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import type { InstanceId } from './types/ids';

const DECK = ['Call the Scions', 'Forest', 'Plains'];

function tokensOf(game: Game, player: string): InstanceId[] {
  return battlefieldOf(game, player).filter((id) => game.state.cards[id]?.isToken === true);
}

function describeCard(game: Game, id: InstanceId): string {
  const d = derive(game.state, ORACLE, game.deps.scripts, id);
  return `${d.name} ${d.power}/${d.toughness} ${d.colors.join('') || 'C'} ${d.typeLine.raw}`;
}

describe('D473 - the quoted token', () => {
  test('the description reads whole, to the printing', () => {
    const parsed = parseEffects('Create two 1/1 colorless Eldrazi Scion creature tokens. They have "Sacrifice this token: Add {C}."', 'Call the Scions', true);
    expect(parsed.mode).toBe('auto');
    expect(parsed.effects).toHaveLength(1);
    expect(parsed.effects[0]?.kind).toBe('createToken');
    expect(parsed.effects[0]?.amount).toBe(2);
    expect(parsed.effects[0]?.token?.name).toBe('Eldrazi Scion');
  });

  test('Call the Scions resolves by itself, and a Scion is sacrificed for {C} as printed', () => {
    const game = startedGame({ players: 2, decks: [DECK, DECK] });
    fullControl(game, 'p1');
    const card = put(game, 'p1', 'Call the Scions', 'hand');
    must(game.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card }));
    advanceUntil(game, (s) => s.stack.length === 0, 20_000);

    const scions = tokensOf(game, 'p1');
    expect(scions).toHaveLength(2);
    for (const id of scions) expect(describeCard(game, id)).toBe('Eldrazi Scion 1/1 C Token Creature — Eldrazi Scion');

    // The token's own line, run by the engine: a sacrifice cost beside no {T}, charged at the tap (D325).
    const scion = scions[0] as InstanceId;
    const source = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1', { includeConditional: true, includeCostly: true }).find((x) => x.card === scion);
    if (!source) throw new Error('the Scion is no mana source');
    expect(source.conditional).toBe(false);
    expect(source.extraCost?.sacrificeSelf).toBe(true);
    const before = game.state.players.p1?.pool.C ?? 0;
    must(game.submit({ t: 'TapForMana', player: 'p1', card: scion, abilityIndex: source.abilityIndex, outputChoice: 0 }));
    expect(game.state.players.p1?.pool.C).toBe(before + 1);
    expect(tokensOf(game, 'p1')).toHaveLength(1);
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });
});
