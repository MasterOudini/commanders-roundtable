// `Skullmead Cauldron` — the tap alone is 1 life; the tap and a discarded
// card of my choice (D286) are 3.

import { SKULLMEAD_CAULDRON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKULLMEAD_CAULDRON, '{T}: You gain 1 life.\n{T}, Discard a card: You gain 3 life.');
const ONE = PRINTED.split('\n')[0] as string;
const THREE = PRINTED.split('\n')[1] as string;

function gain(amount: number): ActivatedDef['resolve'] {
  return (ctx, _self, obj): readonly EventBody[] => {
    const me = ctx.state.players[obj.controller];
    if (!me || me.hasLost) return [];
    return [{ t: 'LifeChanged', player: obj.controller, delta: amount, to: me.life + amount }];
  };
}

export const SKULLMEAD_CAULDRON_SCRIPT: CardScript = {
  oracleId: SKULLMEAD_CAULDRON.oracleId,
  name: SKULLMEAD_CAULDRON.name,
  activated: [
    { ref: `${SKULLMEAD_CAULDRON.oracleId}#a0`, text: ONE, resolve: gain(1) },
    { ref: `${SKULLMEAD_CAULDRON.oracleId}#a1`, text: THREE, resolve: gain(3) },
  ],
};
