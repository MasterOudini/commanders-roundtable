// `Black Panther, Claws of Bast` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLACK_PANTHER_CLAWS_OF_BAST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(BLACK_PANTHER_CLAWS_OF_BAST, "Lifelink (Damage dealt by this creature also causes you to gain that much life.)\nWhenever a creature you control attacks alone, put a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature.", BLACK_PANTHER_CLAWS_OF_BAST.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const BLACK_PANTHER_CLAWS_OF_BAST_SCRIPT: CardScript = {
  oracleId: BLACK_PANTHER_CLAWS_OF_BAST.oracleId,
  name: BLACK_PANTHER_CLAWS_OF_BAST.name,
  triggers: [
    {
      abilityId: 'aCreatureAttacksAlone-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'AttackersDeclared' && ev.attackers.length === 1 ? ev.attackers.map((a) => a.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers.every((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Black Panther, Claws of Bast - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
