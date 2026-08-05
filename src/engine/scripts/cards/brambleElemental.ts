// `Bramble Elemental` — "Whenever an Aura becomes attached to this creature,
// create two 1/1 green Saproling creature tokens." The first ATTACHMENT
// trigger: it watches `AttachmentChanged` (today raised only by the Tier-3
// attach tool, D96) for an Aura landing on ITSELF, and the two Saprolings
// ride D164's advancing allocator. M6.4h, D165.

import { BRAMBLE_ELEMENTAL } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  BRAMBLE_ELEMENTAL,
  'Whenever an Aura becomes attached to this creature, create two 1/1 green Saproling creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const BRAMBLE_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: BRAMBLE_ELEMENTAL.oracleId,
  name: BRAMBLE_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'aura-attached',
      text: TEXT,
      event: 'AttachmentChanged',
      activeZones: ['battlefield'],
      optional: false,
      // "an Aura" is asked of derive (a granted type counts); "to this
      // creature" is the event's own `to`.
      matches: (ctx, self, ev) =>
        ev.t === 'AttachmentChanged' &&
        ev.to === self &&
        ctx.derive(ev.card).typeLine.subtypes.includes('Aura'),
      label: () => 'Bramble Elemental — create two 1/1 Saprolings',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
