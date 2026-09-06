// `Jolrael's Favor` - an activation regenerateAttached
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JOLRAEL_S_FAVOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JOLRAEL_S_FAVOR, "Flash\nEnchant creature\n{1}{G}: Regenerate enchanted creature.");
const LINES = PRINTED.split('\n');

export const JOLRAELS_FAVOR_SCRIPT: CardScript = {
  oracleId: JOLRAEL_S_FAVOR.oracleId,
  name: JOLRAEL_S_FAVOR.name,
  activated: [
    {
      ref: `${JOLRAEL_S_FAVOR.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: host }];
      },
    },
  ],
};
