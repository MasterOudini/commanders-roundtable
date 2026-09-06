// D343 - THE MODAL SEAM, the ability half. A `TriggerDef` declares its modes
// (`modes`, `modeChoice`); the bus copies them onto the pending trigger; as the
// trigger is put on the stack the engine asks `chooseModes` (CR 603.3c) with the
// modes whose targets can be filled, records the answer on the stack object,
// asks the chosen modes' targets, and the def's `resolve` reads `obj.modes`.
// Proven on a testing script over Grizzly Bears (a vanilla body, so the printed
// text claims nothing): an ETB that taps an opponent's creature or gains life.
import { describe, expect, test } from 'vitest';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';

const TAP = 'Tap target creature an opponent controls.';
const GAIN = 'You gain 3 life.';

const MODAL_BEARS: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  triggers: [
    {
      abilityId: 'etbModal',
      text: 'When this creature enters, choose one —',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: [{ text: TAP, targets: parseTargetClauses(TAP) }, { text: GAIN }],
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => 'Grizzly Bears — choose one',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.modes.includes(1)) {
          const life = ctx.state.players[obj.controller]?.life ?? 0;
          return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: life + 3 }];
        }
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2's Cyclops (when asked for) on the board; p1's Bears enters and its trigger asks for a mode. */
function entered(withOpponentCreature = true): { g: Game; cyclops: InstanceId | null } {
  const g = startedGame({ players: 2, decks: [[BEARS], [CYCLOPS]], scripts: createRegistry([MODAL_BEARS]) });
  holdEverywhere(g);
  const cyclops = withOpponentCreature ? put(g, 'p2', CYCLOPS) : null;
  settle(g);
  put(g, 'p1', BEARS);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
  return { g, cyclops };
}

describe('D343 - a modal trigger', () => {
  test('the object is on the stack before the modes are asked; the tap mode then asks its target and taps it', () => {
    const { g, cyclops } = entered();
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    if (ask?.kind !== 'chooseModes') return;
    expect(ask.forKind).toBe('trigger');
    expect(ask.player).toBe('p1');
    expect(ask.options).toEqual([TAP, GAIN]);
    expect(ask.legal).toEqual([0, 1]);
    expect(g.state.stack.some((o) => o.id === ask.stackId && o.kind === 'triggered')).toBe(true);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    expect(g.state.stack.find((o) => o.id === ask.stackId)?.modes).toEqual([0]);
    const aim = g.state.priority.awaiting;
    expect(aim?.kind).toBe('chooseTargets');
    if (aim?.kind !== 'chooseTargets') return;
    expect(aim.forKind).toBe('trigger');
    expect(aim.specs.map((s) => s.text)).toEqual(['target creature an opponent controls']);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops as InstanceId }] }));
    settle(g);
    expect(g.state.cards[cyclops as InstanceId]?.tapped).toBe(true);
    expect(g.log.some((e) => e.body.t === 'StackModesSet' && e.body.modes.length === 1 && e.body.modes[0] === 0)).toBe(true);
  });

  test('the life mode asks no target and resolves at once', () => {
    const { g, cyclops } = entered();
    const life = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    expect(g.state.priority.awaiting).toBeNull();
    settle(g);
    expect(g.state.players.p1?.life).toBe(life + 3);
    expect(g.state.cards[cyclops as InstanceId]?.tapped).toBe(false);
  });

  test('with no opponent creature only the life mode is offered; the tap mode is refused by name', () => {
    const { g } = entered(false);
    const ask = g.state.priority.awaiting;
    if (ask?.kind === 'chooseModes') expect(ask.legal).toEqual([1]);
    const refused = g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe('illegalMode');
    const notMine = g.submit({ t: 'ChooseModes', player: 'p2', modes: [1] });
    expect(notMine.ok).toBe(false);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
  });

  test('the answer replays to the same hash', () => {
    const { g, cyclops } = entered();
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops as InstanceId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
