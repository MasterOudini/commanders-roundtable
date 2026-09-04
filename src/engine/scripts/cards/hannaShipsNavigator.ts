// `Hanna, Ship's Navigator` - returnToHand on "Return target artifact or enchantment card from your graveyard to your hand": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { HANNA_SHIP_S_NAVIGATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HANNA_SHIP_S_NAVIGATOR, "{1}{W}{U}, {T}: Return target artifact or enchantment card from your graveyard to your hand.");
const TEXT = PRINTED;

export const HANNA_SHIPS_NAVIGATOR_SCRIPT: CardScript = {
  oracleId: HANNA_SHIP_S_NAVIGATOR.oracleId,
  name: HANNA_SHIP_S_NAVIGATOR.name,
  activated: [
    {
      ref: `${HANNA_SHIP_S_NAVIGATOR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
