// `Season of Growth` — "Whenever a creature you control enters, scry 1.
// (reminder)\nWhenever you cast a spell that targets a creature you
// control, draw a card." Dazzling Angel's entry PAIR (D170) over every
// creature of mine with D195's scry (the ask LAST), and Gnarlback Rhino's
// cast watcher widened from "this creature" to any creature I control — the
// targets sit on the cast stack object. D280.

import { SEASON_OF_GROWTH } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(
  SEASON_OF_GROWTH,
  'Whenever a creature you control enters, scry 1. (Look at the top card of your library. You may put that card on the bottom.)\nWhenever you cast a spell that targets a creature you control, draw a card.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const TARGETED = PRINTED.split('\n')[1] as string;

/** "a creature you control" — asked of the DERIVED card. */
function myCreature(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  const inst = ctx.state.cards[id];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(id).typeLine.types.includes('Creature');
}

function scryOne(ctx: ScriptCtx, controller: string, label: string): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const n = Math.min(1, library.length);
  if (n === 0) return [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [controller] },
    {
      t: 'AwaitingSet',
      awaiting: { kind: 'scryChoice', player: controller, count: n, toGraveyard: false, thenDraw: 0, label },
    },
  ];
}

export const SEASON_OF_GROWTH_SCRIPT: CardScript = {
  oracleId: SEASON_OF_GROWTH.oracleId,
  name: SEASON_OF_GROWTH.name,
  triggers: [
    {
      abilityId: 'enters-card',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && myCreature(ctx, self, m.card),
        ),
      label: () => 'Season of Growth — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => scryOne(ctx, obj.controller, obj.label),
    },
    {
      abilityId: 'enters-token',
      text: ENTERS,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && myCreature(ctx, self, ev.card),
      label: () => 'Season of Growth — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => scryOne(ctx, obj.controller, obj.label),
    },
    {
      abilityId: 'targeted-cast',
      text: TARGETED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ev.obj.targets.some((t) => t.kind === 'card' && myCreature(ctx, self, t.id)),
      label: () => 'Season of Growth — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
