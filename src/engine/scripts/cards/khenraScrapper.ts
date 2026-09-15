// `Khenra Scrapper` - a exertAttack trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KHENRA_SCRAPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KHENRA_SCRAPPER, "Menace\nYou may exert this creature as it attacks. When you do, it gets +2/+0 until end of turn. (An exerted creature won't untap during your next untap step.)");
const LINES = PRINTED.split('\n');

export const KHENRA_SCRAPPER_SCRIPT: CardScript = {
  oracleId: KHENRA_SCRAPPER.oracleId,
  name: KHENRA_SCRAPPER.name,
  triggers: [
    {
      abilityId: 'exertAttack-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Khenra Scrapper - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
