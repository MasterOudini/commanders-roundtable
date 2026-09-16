// `Cryogen Relic` - a etb trigger draw, a leavesBattlefield trigger draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYOGEN_RELIC } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(CRYOGEN_RELIC, "When this artifact enters or leaves the battlefield, draw a card.\n{1}{U}, Sacrifice this artifact: Put a stun counter on up to one target tapped creature. (If a permanent with a stun counter would become untapped, remove one from it instead.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a stun counter on up to one target tapped creature.", CRYOGEN_RELIC.name);
const VOCAB_T_A0 = vocabularyTargets("Put a stun counter on up to one target tapped creature.");

export const CRYOGEN_RELIC_SCRIPT: CardScript = {
  oracleId: CRYOGEN_RELIC.oracleId,
  name: CRYOGEN_RELIC.name,
  activated: [
    {
      ref: `${CRYOGEN_RELIC.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Cryogen Relic - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'leavesBattlefield-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Cryogen Relic - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
