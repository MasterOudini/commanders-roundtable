// `Silkbind Faerie` - an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILKBIND_FAERIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILKBIND_FAERIE, "Flying\n{1}{W/U}, {Q}: Tap target creature. ({Q} is the untap symbol.)");
const LINES = PRINTED.split('\n');

export const SILKBIND_FAERIE_SCRIPT: CardScript = {
  oracleId: SILKBIND_FAERIE.oracleId,
  name: SILKBIND_FAERIE.name,
  activated: [
    {
      ref: `${SILKBIND_FAERIE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
