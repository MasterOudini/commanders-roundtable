// `Battlegrace Angel` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTLEGRACE_ANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTLEGRACE_ANGEL, "Flying\nExalted (Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.)\nWhenever a creature you control attacks alone, it gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature gains lifelink until end of turn.", BATTLEGRACE_ANGEL.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature gains lifelink until end of turn.");

export const BATTLEGRACE_ANGEL_SCRIPT: CardScript = {
  oracleId: BATTLEGRACE_ANGEL.oracleId,
  name: BATTLEGRACE_ANGEL.name,
  triggers: [
    {
      abilityId: 'aCreatureAttacksAlone-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'AttackersDeclared' && ev.attackers.length === 1 ? ev.attackers.map((a) => a.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers.every((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Battlegrace Angel - Target creature gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
