// `Stonehands` - a static attachedStatic, an activation attachedTemp
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONEHANDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONEHANDS, "Enchant creature\nEnchanted creature gets +0/+2.\n{R}: Enchanted creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const STONEHANDS_SCRIPT: CardScript = {
  oracleId: STONEHANDS.oracleId,
  name: STONEHANDS.name,
  activated: [
    {
      ref: `${STONEHANDS.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 1, toughness: 0 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
