// `Desolation Twin` — "When you cast this spell, create a 10/10 colorless
// Eldrazi creature token." The FIRST cast-of-ITSELF trigger (D171): it
// watches `SpellCast` for its OWN instance and is active in the STACK zone —
// the one zone the card occupies at the moment the trigger the card
// describes can fire. The token arrives while the Twin is still on the
// stack, which is exactly the printed timing. M6.4o, D171.

import { DESOLATION_TWIN } from '../../../data/fixtures/engineCards';
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
  DESOLATION_TWIN,
  'When you cast this spell, create a 10/10 colorless Eldrazi creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ELDRAZI = tokenRef('Eldrazi|10/10||Creature|');

export const DESOLATION_TWIN_SCRIPT: CardScript = {
  oracleId: DESOLATION_TWIN.oracleId,
  name: DESOLATION_TWIN.name,
  triggers: [
    {
      abilityId: 'self-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['stack'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => 'Desolation Twin — create a 10/10 Eldrazi',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ELDRAZI.oracleId,
          printingId: ELDRAZI.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
