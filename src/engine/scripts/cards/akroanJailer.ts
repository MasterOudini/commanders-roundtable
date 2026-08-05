// `Akroan Jailer` — "{2}{W}, {T}: Tap target creature." A targeted ActivatedDef
// whose effect is the engine's own tap event. M6.4c, D160.

import { AKROAN_JAILER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AKROAN_JAILER, '{2}{W}, {T}: Tap target creature.');

export const AKROAN_JAILER_SCRIPT: CardScript = {
  oracleId: AKROAN_JAILER.oracleId,
  name: AKROAN_JAILER.name,
  activated: [
    {
      ref: `${AKROAN_JAILER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        // Mirrors `effects.ts`'s tap: gone or already turned → nothing.
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
