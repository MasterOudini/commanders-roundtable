// `Smokespew Invoker` — "{7}{B}: Target creature gets -3/-3 until end of
// turn." The activated debuff with no tap. D249.

import { SMOKESPEW_INVOKER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SMOKESPEW_INVOKER, '{7}{B}: Target creature gets -3/-3 until end of turn.');

export const SMOKESPEW_INVOKER_SCRIPT: CardScript = {
  oracleId: SMOKESPEW_INVOKER.oracleId,
  name: SMOKESPEW_INVOKER.name,
  activated: [
    {
      ref: `${SMOKESPEW_INVOKER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 }];
      },
    },
  ],
};
