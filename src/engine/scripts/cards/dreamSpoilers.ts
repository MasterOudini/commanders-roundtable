// `Dream Spoilers` - pump on "up to one target creature an opponent controls gets -1/-1 until end of turn", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { DREAM_SPOILERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAM_SPOILERS, "Flying\nWhenever you cast a spell during an opponent's turn, up to one target creature an opponent controls gets -1/-1 until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const DREAM_SPOILERS_SCRIPT: CardScript = {
  oracleId: DREAM_SPOILERS.oracleId,
  name: DREAM_SPOILERS.name,
  triggers: [
    {
      abilityId: 'castOpponentTurn',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ctx.query.controllerOf(self),
      label: () => "Dream Spoilers - up to one target creature an opponent controls gets -1/-1 until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 });
        }
        return out;
      },
    },
  ],
};
