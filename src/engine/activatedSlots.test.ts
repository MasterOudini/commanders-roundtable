// D586 - AN ACTIVATED ABILITY RESOLVES EVERY PICK (a card bug the D586 graveyard measurer proved, pre-existing): a counted
// target clause (`each of up to two target creatures`, `up to three target creature cards`) resolves each of its picks off
// `StackObject.targetSlots` - the clause every pick answers (D299). The cast and a trigger's aim recorded the slots; an
// ACTIVATION never did - neither its inline targets nor its staged aim reached the stack object - so `picksFor` fell back to
// one target per clause and the ability resolved its FIRST pick alone. Nine shipped activated clauses were short (Fire
// Shrine Keeper's second Bears survived; Soul of Innistrad returned one card of three). Proven both ways an activation is
// aimed: the targets on the intent, and the host's own targets prompt.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { AJANI_ADVERSARY_OF_TYRANTS_SCRIPT } from './scripts/cards/ajaniAdversaryOfTyrants';
import { FIRE_SHRINE_KEEPER_SCRIPT } from './scripts/cards/fireShrineKeeper';
import { SOUL_OF_INNISTRAD_SCRIPT } from './scripts/cards/soulOfInnistrad';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const zone = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const cards = (ids: readonly InstanceId[]) => ids.map((id) => ({ kind: 'card' as const, id }));

function keeperGame(): { g: Game; keeper: InstanceId; a: InstanceId; b: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Fire Shrine Keeper'], ['Grizzly Bears', 'Grizzly Bears']], scripts: createRegistry([FIRE_SHRINE_KEEPER_SCRIPT]) });
  holdEverywhere(g);
  const keeper = put(g, 'p1', 'Fire Shrine Keeper');
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  main3(g);
  mana(g, 'C', 7);
  mana(g, 'R', 1);
  return { g, keeper, a, b };
}

function soulGame(): { g: Game; soul: InstanceId; dead: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [['Soul of Innistrad', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([SOUL_OF_INNISTRAD_SCRIPT]) });
  holdEverywhere(g);
  const soul = put(g, 'p1', 'Soul of Innistrad');
  const dead = [put(g, 'p1', 'Grizzly Bears', 'graveyard'), put(g, 'p1', 'Grizzly Bears', 'graveyard'), put(g, 'p1', 'Grizzly Bears', 'graveyard')];
  main3(g);
  mana(g, 'C', 3);
  mana(g, 'B', 2);
  return { g, soul, dead };
}

describe('D586 - an activated ability resolves every pick of a counted target clause', () => {
  test('Fire Shrine Keeper, its targets on the intent: both Bears take 3 and die', () => {
    const { g, keeper, a, b } = keeperGame();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0, targets: cards([a, b]) }));
    settle(g);
    expect(zone(g, a), 'the first pick').toBe('graveyard');
    expect(zone(g, b), 'the second pick').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Fire Shrine Keeper, aimed at the host prompt: both Bears take 3 and die', () => {
    const { g, keeper, a, b } = keeperGame();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: keeper, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: cards([a, b]) }));
    settle(g);
    expect(zone(g, a), 'the first pick').toBe('graveyard');
    expect(zone(g, b), 'the second pick').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Ajani, Adversary of Tyrants +1 (a loyalty ability): both creatures take the counter (the intent, then the prompt)', () => {
    for (const staged of [false, true]) {
      const g = startedGame({ players: 2, decks: [['Ajani, Adversary of Tyrants', 'Grizzly Bears', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([AJANI_ADVERSARY_OF_TYRANTS_SCRIPT]) });
      holdEverywhere(g);
      const ajani = put(g, 'p1', 'Ajani, Adversary of Tyrants');
      const a = put(g, 'p1', 'Grizzly Bears');
      const b = put(g, 'p1', 'Grizzly Bears');
      main3(g);
      if (staged) {
        must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ajani, abilityIndex: 0 }));
        advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
        must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: cards([a, b]) }));
      } else {
        must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ajani, abilityIndex: 0, targets: cards([a, b]) }));
      }
      settle(g);
      expect([a, b].map((id) => g.state.cards[id]?.counters['+1/+1'] ?? 0), staged ? 'the prompt' : 'the intent').toEqual([1, 1]);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });

  test('Soul of Innistrad, three creature cards named: all three return to the hand (the intent, then the prompt)', () => {
    for (const staged of [false, true]) {
      const { g, soul, dead } = soulGame();
      if (staged) {
        must(g.submit({ t: 'ActivateAbility', player: 'p1', card: soul, abilityIndex: 0 }));
        advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
        must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: cards(dead) }));
      } else {
        must(g.submit({ t: 'ActivateAbility', player: 'p1', card: soul, abilityIndex: 0, targets: cards(dead) }));
      }
      settle(g);
      expect(dead.map((id) => zone(g, id)), staged ? 'the prompt' : 'the intent').toEqual(['hand', 'hand', 'hand']);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });
});
