// `Keldon Mantle` - an activation regenerateAttached, an activation attachedTemp, an activation attachedTemp
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KELDON_MANTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KELDON_MANTLE, "Enchant creature\n{B}: Regenerate enchanted creature.\n{R}: Enchanted creature gets +1/+0 until end of turn.\n{G}: Enchanted creature gains trample until end of turn.");
const LINES = PRINTED.split('\n');

export const KELDON_MANTLE_SCRIPT: CardScript = {
  oracleId: KELDON_MANTLE.oracleId,
  name: KELDON_MANTLE.name,
  activated: [
    {
      ref: `${KELDON_MANTLE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: host }];
      },
    },
    {
      ref: `${KELDON_MANTLE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${KELDON_MANTLE.oracleId}#a2`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 0, toughness: 0, keywords: ["trample"] }];
      },
    },
  ],
};
