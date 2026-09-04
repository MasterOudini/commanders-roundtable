// `Agent Bishop, Man in Black` - plusCounter on "put a +1/+1 counter on each of up to two target creatures", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { AGENT_BISHOP_MAN_IN_BLACK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(AGENT_BISHOP_MAN_IN_BLACK, "At the beginning of combat on your turn, put a +1/+1 counter on each of up to two target creatures.");
const TEXT = PRINTED;

export const AGENT_BISHOP_MAN_IN_BLACK_SCRIPT: CardScript = {
  oracleId: AGENT_BISHOP_MAN_IN_BLACK.oracleId,
  name: AGENT_BISHOP_MAN_IN_BLACK.name,
  triggers: [
    {
      abilityId: 'beginCombat',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Agent Bishop, Man in Black - put a +1/+1 counter on each of up to two target creatures",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] });
        }
        return out;
      },
    },
  ],
};
