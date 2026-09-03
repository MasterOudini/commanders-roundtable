// `Voltaic Construct` - untap on "Untap target artifact creature": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { VOLTAIC_CONSTRUCT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOLTAIC_CONSTRUCT, "{2}: Untap target artifact creature.");
const TEXT = PRINTED;

export const VOLTAIC_CONSTRUCT_SCRIPT: CardScript = {
  oracleId: VOLTAIC_CONSTRUCT.oracleId,
  name: VOLTAIC_CONSTRUCT.name,
  activated: [
    {
      ref: `${VOLTAIC_CONSTRUCT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (!card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
