// `Vildin-Pack Outcast // Dronepack Kindred` - an activation pumping itself, an activation vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED, "Trample\n{R}: This creature gets +1/-1 until end of turn.\n{5}{R}{R}: Transform this creature.\nTrample\n{1}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = transformFrom(vocabularyEffects("Transform this creature.", VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.name), 0);
const VOCAB_T_A1 = vocabularyTargets("Transform this creature.");

export const VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED_SCRIPT: CardScript = {
  oracleId: VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.oracleId,
  name: VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.name,
  activated: [
    {
      ref: `${VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
    {
      ref: `${VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.oracleId}#a1`, face: 0,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${VILDIN_PACK_OUTCAST_DRONEPACK_KINDRED.oracleId}#a0`, face: 1,
      text: LINES[4] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
