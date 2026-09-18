// D492 - THE ONCE-PER-TURN TRIGGER. `This ability triggers only once each turn.` (and `Do this only once each turn.`)
// is a def's own limit (`TriggerDef.oncePerTurn`), enforced at the bus: `collectTriggers` queues the first match of a
// turn per source and none after it - a match already recorded on `TurnState.triggered` (bumped by the reducer as the
// pending trigger is queued) or earlier in the same collection (two creatures entering at once) is not queued at all;
// the record clears with the turn. The classifier reads the rider off a trigger line and rates the payload before it.
// What is proven here: a second match in the same turn is not queued and the next turn's is; two matches in ONE batch
// queue one; the record is on the state (the replay hash); the classifier's reading.
import { describe, expect, test } from 'vitest';
import { primitiveFor } from '../data/primitives';
import { TOKEN_TABLE } from '../data/tokenTable';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const handOf = (g: Game) => (g.state.zones.hand['p1'] ?? []).length;

/** `Whenever another creature enters under your control, draw a card. This ability triggers only once each turn.` on a fixture. */
function watcher(name: string, oncePerTurn: boolean): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const payload = 'Draw a card.';
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [
      {
        abilityId: 'anotherCreatureEnters-0',
        text: card.faces[0]?.oracleText ?? '',
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        ...(oncePerTurn ? { oncePerTurn: true as const } : {}),
        matches: (ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.query.controllerOf(m.card) === ctx.query.controllerOf(self) && ctx.derive(m.card).isCreature),
        label: () => name + ' - draw a card (once each turn)',
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      },
      {
        abilityId: 'tokensEnter-1',
        text: card.faces[0]?.oracleText ?? '',
        event: 'TokenCreated',
        activeZones: ['battlefield'],
        optional: false,
        ...(oncePerTurn ? { oncePerTurn: true as const } : {}),
        matches: (ctx, self, ev) => ev.t === 'TokenCreated' && ctx.query.controllerOf(ev.card) === ctx.query.controllerOf(self),
        label: () => name + ' - draw a card for the tokens (once each turn)',
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

describe('D492 - the once-per-turn trigger', () => {
  test('the classifier reads the rider off a trigger line and rates the payload before it', () => {
    expect(primitiveFor({ text: 'Whenever another creature you control enters, draw a card. This ability triggers only once each turn.', kind: 'sentence', raw: '' }, 'Trained Condor')).toBe('scriptable');
    expect(primitiveFor({ text: 'Whenever another creature you control enters, you may draw a card. Do this only once each turn.', kind: 'sentence', raw: '' }, 'Trained Condor')).toBe('scriptable');
  });

  test('a second match in the same turn is not queued; the next turn triggers again; the replay hash', () => {
    // Tokens, so the hand moves only by the draws (`put` takes a listed card from the library OR the hand).
    const servo = TOKEN_TABLE['Servo|1/1||Artifact Creature|'];
    if (!servo) throw new Error('no Servo pin');
    const g = startedGame({ players: 2, decks: [['Trained Condor', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([watcher('Trained Condor', true)]) });
    holdEverywhere(g);
    const condor = put(g, 'p1', 'Trained Condor');
    settle(g);
    main(g, 3);
    const before = handOf(g);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: servo.printingId, count: 1 }));
    settle(g);
    expect(handOf(g), 'the first entry of the turn draws').toBe(before + 1);
    expect(g.state.turn.triggered[`${condor}|${ORACLE.byName('Trained Condor')?.oracleId}#tokensEnter-1`]).toBe(1);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: servo.printingId, count: 1 }));
    settle(g);
    expect(handOf(g), 'the second entry of the turn does not trigger').toBe(before + 1);
    expect(g.state.pendingTriggers).toHaveLength(0);
    main(g, 5);
    expect(g.state.turn.triggered, 'the record clears with the turn').toEqual({});
    const later = handOf(g);
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: servo.printingId, count: 1 }));
    settle(g);
    expect(handOf(g), 'a new turn, a new firing').toBe(later + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two matches in one batch queue one trigger; without the rider they queue two', () => {
    const servo = TOKEN_TABLE['Servo|1/1||Artifact Creature|'];
    if (!servo) throw new Error('no Servo pin');
    for (const rider of [true, false]) {
      const g = startedGame({ players: 2, decks: [['Trained Condor', 'Grizzly Bears'], ['Grizzly Bears']], scripts: createRegistry([watcher('Trained Condor', rider)]) });
      holdEverywhere(g);
      put(g, 'p1', 'Trained Condor');
      settle(g);
      main(g, 3);
      const before = handOf(g);
      must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: servo.printingId, count: 2 }));
      settle(g);
      expect(handOf(g), rider ? 'two tokens at once: one draw' : 'two tokens at once: two draws').toBe(before + (rider ? 1 : 2));
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });
});
