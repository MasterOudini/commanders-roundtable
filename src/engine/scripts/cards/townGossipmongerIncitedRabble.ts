// `Town Gossipmonger // Incited Rabble` - an activation vocab, a static mustAttack, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOWN_GOSSIPMONGER_INCITED_RABBLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOWN_GOSSIPMONGER_INCITED_RABBLE, "{T}, Tap an untapped creature you control: Transform this creature.\nThis creature attacks each combat if able.\n{2}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", TOWN_GOSSIPMONGER_INCITED_RABBLE.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const TOWN_GOSSIPMONGER_INCITED_RABBLE_SCRIPT: CardScript = {
  oracleId: TOWN_GOSSIPMONGER_INCITED_RABBLE.oracleId,
  name: TOWN_GOSSIPMONGER_INCITED_RABBLE.name,
  activated: [
    {
      ref: `${TOWN_GOSSIPMONGER_INCITED_RABBLE.oracleId}#a0`, face: 0,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${TOWN_GOSSIPMONGER_INCITED_RABBLE.oracleId}#a0`, face: 1,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1', face: 1,
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
