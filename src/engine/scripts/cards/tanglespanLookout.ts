// `Tanglespan Lookout` — "Whenever an Aura you control enters, draw a card."
// Rimefur Reindeer's controlled-entry PAIR with the entrant typed by SUBTYPE
// rather than by card type: two defs, because a token entering is a
// `TokenCreated` and never a `CardsMoved` (Soul Warden's rule, D158) and the
// printed line carries no `nontoken` to exclude it. D256.

import { TANGLESPAN_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TANGLESPAN_LOOKOUT, 'Whenever an Aura you control enters, draw a card.');

/** "an Aura you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Aura');
}

function draw(ctx: ScriptCtx, obj: { controller: string }): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player || player.hasLost) return [];
  return [...drawEvents(ctx.state, obj.controller, 1)];
}

export const TANGLESPAN_LOOKOUT_SCRIPT: CardScript = {
  oracleId: TANGLESPAN_LOOKOUT.oracleId,
  name: TANGLESPAN_LOOKOUT.name,
  triggers: [
    {
      abilityId: 'aura-etb-card',
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
      label: () => 'Tanglespan Lookout — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
    {
      abilityId: 'aura-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Tanglespan Lookout — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => draw(ctx, obj),
    },
  ],
};
