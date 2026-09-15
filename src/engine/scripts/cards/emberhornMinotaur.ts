// `Emberhorn Minotaur` - a exertAttack trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBERHORN_MINOTAUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBERHORN_MINOTAUR, "You may exert this creature as it attacks. When you do, it gets +1/+1 and gains menace until end of turn. (An exerted creature won't untap during your next untap step. A creature with menace can't be blocked except by two or more creatures.)");

export const EMBERHORN_MINOTAUR_SCRIPT: CardScript = {
  oracleId: EMBERHORN_MINOTAUR.oracleId,
  name: EMBERHORN_MINOTAUR.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Emberhorn Minotaur - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1, keywords: ["menace"] }];
      },
    },
  ],
};
