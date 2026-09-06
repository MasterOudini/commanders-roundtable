// `Yavimaya Hollow` - an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAVIMAYA_HOLLOW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAVIMAYA_HOLLOW, "{T}: Add {C}.\n{G}, {T}: Regenerate target creature.");
const LINES = PRINTED.split('\n');

export const YAVIMAYA_HOLLOW_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_HOLLOW.oracleId,
  name: YAVIMAYA_HOLLOW.name,
  activated: [
    {
      ref: `${YAVIMAYA_HOLLOW.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: target.id }];
      },
    },
  ],
};
