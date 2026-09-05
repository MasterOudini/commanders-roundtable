// `Thalakos Scout` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THALAKOS_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THALAKOS_SCOUT, "Shadow (This creature can block or be blocked by only creatures with shadow.)\nDiscard a card: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

export const THALAKOS_SCOUT_SCRIPT: CardScript = {
  oracleId: THALAKOS_SCOUT.oracleId,
  name: THALAKOS_SCOUT.name,
  activated: [
    {
      ref: `${THALAKOS_SCOUT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
