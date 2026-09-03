// `Dwarven Bloodboiler` — tapping an untapped Dwarf I control (the D286 tap
// chooser; the Bloodboiler is a Dwarf) gives a creature +2/+0 until cleanup.

import { DWARVEN_BLOODBOILER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DWARVEN_BLOODBOILER, 'Tap an untapped Dwarf you control: Target creature gets +2/+0 until end of turn.');

export const DWARVEN_BLOODBOILER_SCRIPT: CardScript = {
  oracleId: DWARVEN_BLOODBOILER.oracleId,
  name: DWARVEN_BLOODBOILER.name,
  activated: [
    {
      ref: `${DWARVEN_BLOODBOILER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0, keywords: [] }];
      },
    },
  ],
};
