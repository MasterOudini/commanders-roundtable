// `Shadow Lance` - a static attachedStatic, an activation attachedTemp
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHADOW_LANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHADOW_LANCE, "Enchant creature\nEnchanted creature has first strike.\n{1}{B}: Enchanted creature gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const SHADOW_LANCE_SCRIPT: CardScript = {
  oracleId: SHADOW_LANCE.oracleId,
  name: SHADOW_LANCE.name,
  activated: [
    {
      ref: `${SHADOW_LANCE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 2, toughness: 2 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
