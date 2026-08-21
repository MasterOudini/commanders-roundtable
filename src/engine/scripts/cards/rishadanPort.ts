// `Rishadan Port` — "{T}: Add {C}. / {1}, {T}: Tap target land." The
// mana line is the engine's (a0, it COUNTS); the def claims only the
// tap at #a1. D240.

import { RISHADAN_PORT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RISHADAN_PORT, '{T}: Add {C}.\n{1}, {T}: Tap target land.');
const TEXT = PRINTED.split('\n')[1] as string;

export const RISHADAN_PORT_SCRIPT: CardScript = {
  oracleId: RISHADAN_PORT.oracleId,
  name: RISHADAN_PORT.name,
  activated: [
    {
      ref: `${RISHADAN_PORT.oracleId}#a1`,
      text: TEXT,
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
