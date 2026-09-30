// D593 - THE TAPPED TOKEN: `create a tapped <token>` was unread - the token parser met `tapped` before the token's size and
// refused the clause, so every card that makes a token tapped (and every Powerstone - no card makes one untapped, so the
// token table never baked it) stayed blocked. `tapped` is the created token's entry state, never its identity: the spec
// carries it beside the SAME table key, and the executor taps what it made (mobilize's shape, D463). What is proven: the
// parser reads it and keys it as the untapped description; the vocabulary reads the tapped Treasure, the tapped
// creature token and the Powerstone whole; a trigger's `create a tapped Treasure token` makes one Treasure, tapped; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { parseTokenClause, specKey } from '../data/tokenParse';
import { advanceUntil, holdEverywhere, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

/** An upkeep head on Grizzly Bears whose payload the vocabulary reads (the generated vocab shape). */
function head(payload: string): CardScript {
  const card = ORACLE.byName('Grizzly Bears');
  if (!card) throw new Error('Grizzly Bears is not in the fixtures');
  const effects = vocabularyEffects(payload, 'Grizzly Bears');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Grizzly Bears',
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Grizzly Bears - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D593 - the tapped token: created tapped, keyed as itself', () => {
  test('the parser reads `tapped` as the entry state and keys the token as the untapped description', () => {
    const tapped = parseTokenClause('Create a tapped 2/2 black Zombie creature token.');
    const plain = parseTokenClause('Create a 2/2 black Zombie creature token.');
    expect(tapped?.tapped).toBe(true);
    expect(plain?.tapped).toBeUndefined();
    expect(tapped && plain ? specKey(tapped) : null).toBe(plain ? specKey(plain) : 'no plain');
    expect(parseEffects('Create a tapped Treasure token.', 'Ognis', true).mode).toBe('auto');
    expect(parseEffects('Create a tapped 2/2 black Zombie creature token.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Create a tapped Powerstone token.', 'Argothian Opportunist', true).mode, 'the Powerstone baked at last').toBe('auto');
    expect(parseEffects('Create a 2/2 black Zombie creature token.', 'X', true).mode, 'the untapped form stays read').toBe('auto');
  });

  test('a trigger creates a tapped Treasure token: one Treasure, tapped', () => {
    const payload = 'Create a tapped Treasure token.';
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...TEN], ['Walking Corpse', ...TEN]], scripts: createRegistry([head(payload)]) });
    settle(g);
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const before = new Set(Object.keys(g.state.cards));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain', 20_000);
    settle(g);
    const made = Object.values(g.state.cards).filter((c) => !before.has(c.id) && c.zone.kind === 'battlefield' && ORACLE.byPrinting(c.printingId)?.name === 'Treasure');
    expect(made.length, 'one Treasure').toBe(1);
    expect(made[0]?.tapped, 'created tapped').toBe(true);
    hashHolds(g);
  });
});
