// `Laid to Rest` — "Whenever a Human you control dies, draw a card.\n
// Whenever a creature you control with a +1/+1 counter on it dies, you gain 2
// life." Two looks-back dies watchers over creatures I control (Headless
// Rider's shape, D179): one asks the DERIVED subtype, the other the counter
// the card carried as it died. A countered Human pays both. D277.

import { LAID_TO_REST } from '../../../data/fixtures/engineCards';
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
  LAID_TO_REST,
  'Whenever a Human you control dies, draw a card.\nWhenever a creature you control with a +1/+1 counter on it dies, you gain 2 life.',
);
const HUMAN = PRINTED.split('\n')[0] as string;
const COUNTERED = PRINTED.split('\n')[1] as string;

/** Asked of the PRE-event state (looksBack): mine, and a creature. */
function myCreature(ctx: ScriptCtx, self: InstanceId, id: InstanceId): boolean {
  const inst = ctx.state.cards[id];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(id).typeLine.types.includes('Creature');
}

export const LAID_TO_REST_SCRIPT: CardScript = {
  oracleId: LAID_TO_REST.oracleId,
  name: LAID_TO_REST.name,
  triggers: [
    {
      abilityId: 'human-dies',
      text: HUMAN,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            myCreature(ctx, self, m.card) &&
            ctx.derive(m.card).typeLine.subtypes.includes('Human'),
        ),
      label: () => 'Laid to Rest — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
    {
      abilityId: 'countered-dies',
      text: COUNTERED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            myCreature(ctx, self, m.card) &&
            (ctx.state.cards[m.card]?.counters['+1/+1'] ?? 0) > 0,
        ),
      label: () => 'Laid to Rest — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
