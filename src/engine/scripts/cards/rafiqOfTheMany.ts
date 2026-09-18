// `Rafiq of the Many` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAFIQ_OF_THE_MANY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAFIQ_OF_THE_MANY, "Exalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\nWhenever a creature you control attacks alone, it gains double strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gains double strike until end of turn.", RAFIQ_OF_THE_MANY.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gains double strike until end of turn.");

export const RAFIQ_OF_THE_MANY_SCRIPT: CardScript = {
  oracleId: RAFIQ_OF_THE_MANY.oracleId,
  name: RAFIQ_OF_THE_MANY.name,
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
      label: () => "Rafiq of the Many - Target creature gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
