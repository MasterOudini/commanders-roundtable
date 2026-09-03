// `Narcissism` — green mana and a discarded card of my choice (D286) give a
// creature +2/+2 until cleanup; green mana and the enchantment itself do the
// same.

import { NARCISSISM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { ActivatedDef, CardScript } from '../api';
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

const PRINTED = printed(
  NARCISSISM,
  '{G}, Discard a card: Target creature gets +2/+2 until end of turn.\n{G}, Sacrifice this enchantment: Target creature gets +2/+2 until end of turn.',
);
const LINES = PRINTED.split('\n');

const pump: ActivatedDef['resolve'] = (ctx, _self, obj): readonly EventBody[] => {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
  return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] }];
};

export const NARCISSISM_SCRIPT: CardScript = {
  oracleId: NARCISSISM.oracleId,
  name: NARCISSISM.name,
  activated: [
    { ref: `${NARCISSISM.oracleId}#a0`, text: LINES[0] as string, resolve: pump },
    { ref: `${NARCISSISM.oracleId}#a1`, text: LINES[1] as string, resolve: pump },
  ],
};
