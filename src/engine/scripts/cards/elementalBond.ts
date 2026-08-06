// `Elemental Bond` — "Whenever a creature you control with power 3 or
// greater enters, draw a card." The FIRST power-threshold entry watcher
// (D173): the qualifier is asked of the DERIVED entrant (a pumped 2/2
// qualifies, CR 613 settles before the check), and one printed line is TWO
// TriggerDefs because a token enters via `TokenCreated`, never `CardsMoved`
// (Soul Warden's rule, D158). M6.4q, D173.

import { ELEMENTAL_BOND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  ELEMENTAL_BOND,
  'Whenever a creature you control with power 3 or greater enters, draw a card.',
);

/** "a creature you control with power 3 or greater" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const d = ctx.derive(entrant);
  return d.typeLine.types.includes('Creature') && (d.power ?? 0) >= 3;
}

export const ELEMENTAL_BOND_SCRIPT: CardScript = {
  oracleId: ELEMENTAL_BOND.oracleId,
  name: ELEMENTAL_BOND.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Elemental Bond — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Elemental Bond — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
