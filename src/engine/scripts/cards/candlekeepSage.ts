// `Candlekeep Sage` - a static anthem, a etb trigger draw, a leavesBattlefield trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CANDLEKEEP_SAGE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(CANDLEKEEP_SAGE, "Commander creatures you own have \"When this creature enters or leaves the battlefield, draw a card.\"");

const GRANT_0 = grantedTriggerRef(`${CANDLEKEEP_SAGE.oracleId}#gt0`, CANDLEKEEP_SAGE.name);

export const CANDLEKEEP_SAGE_SCRIPT: CardScript = {
  oracleId: CANDLEKEEP_SAGE.oracleId,
  name: CANDLEKEEP_SAGE.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Candlekeep Sage - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Candlekeep Sage - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.players[ctx.query.controllerOf(self) ?? '']?.commanderIds ?? []).includes(candidate),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
