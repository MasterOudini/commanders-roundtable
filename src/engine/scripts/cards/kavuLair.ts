// `Kavu Lair` - "Whenever a creature with power 4 or greater enters, its controller
// draws a card." - once PER such creature (per-item, D185; `obj.item` is the
// creature), cards and tokens alike; the power is read as it enters. Whole after
// D295's "its controller draws a card" sentence reading.

import { KAVU_LAIR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { StackObject } from '../../types/state';

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

const TEXT = printed(KAVU_LAIR, 'Whenever a creature with power 4 or greater enters, its controller draws a card.');

const bigCreature = (ctx: ScriptCtx, id: InstanceId): boolean => {
  const d = ctx.derive(id);
  return d.typeLine.types.includes('Creature') && (d.power ?? 0) >= 4;
};

function itsControllerDraws(ctx: ScriptCtx, obj: StackObject): readonly EventBody[] {
  const entered = obj.item ? ctx.state.cards[obj.item] : undefined;
  if (!entered) return [];
  return drawEvents(ctx.state, entered.controller, 1);
}

export const KAVU_LAIR_SCRIPT: CardScript = {
  oracleId: KAVU_LAIR.oracleId,
  name: KAVU_LAIR.name,
  triggers: [
    {
      abilityId: 'big-creature-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, _self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves.filter((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && bigCreature(ctx, m.card)).map((m) => m.card),
      label: () => 'Kavu Lair - its controller draws a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => itsControllerDraws(ctx, obj),
    },
    {
      abilityId: 'big-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'TokenCreated',
      perItem: (ctx, _self, ev) => (ev.t === 'TokenCreated' && bigCreature(ctx, ev.card) ? [ev.card] : []),
      label: () => 'Kavu Lair - its controller draws a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => itsControllerDraws(ctx, obj),
    },
  ],
};
