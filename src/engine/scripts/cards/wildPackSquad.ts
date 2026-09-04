// `Wild Pack Squad` - pump on "up to one target creature gains first strike and vigilance until end of turn", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { WILD_PACK_SQUAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WILD_PACK_SQUAD, "At the beginning of combat on your turn, up to one target creature gains first strike and vigilance until end of turn.");
const TEXT = PRINTED;

export const WILD_PACK_SQUAD_SCRIPT: CardScript = {
  oracleId: WILD_PACK_SQUAD.oracleId,
  name: WILD_PACK_SQUAD.name,
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
      label: () => "Wild Pack Squad - up to one target creature gains first strike and vigilance until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["firstStrike", "vigilance"] });
        }
        return out;
      },
    },
  ],
};
