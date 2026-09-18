// `Black Widow, Double Agent` - a aCreatureAttacksAlone trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLACK_WIDOW_DOUBLE_AGENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLACK_WIDOW_DOUBLE_AGENT, "Deathtouch\nWhenever a creature you control attacks alone, it gains first strike and menace until end of turn. (It can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gains first strike and menace until end of turn.", BLACK_WIDOW_DOUBLE_AGENT.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gains first strike and menace until end of turn.");

export const BLACK_WIDOW_DOUBLE_AGENT_SCRIPT: CardScript = {
  oracleId: BLACK_WIDOW_DOUBLE_AGENT.oracleId,
  name: BLACK_WIDOW_DOUBLE_AGENT.name,
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
      label: () => "Black Widow, Double Agent - Target creature gains first strike and menace until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
