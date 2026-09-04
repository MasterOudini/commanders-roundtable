// `Nightmare Sower` - minusCounter on "put a -1/-1 counter on up to one target creature", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { NIGHTMARE_SOWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHTMARE_SOWER, "Flying, lifelink\nWhenever you cast a spell during an opponent's turn, put a -1/-1 counter on up to one target creature.");
const TEXT = PRINTED.split('\n')[1] as string;

export const NIGHTMARE_SOWER_SCRIPT: CardScript = {
  oracleId: NIGHTMARE_SOWER.oracleId,
  name: NIGHTMARE_SOWER.name,
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
      label: () => "Nightmare Sower - put a -1/-1 counter on up to one target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] });
        }
        return out;
      },
    },
  ],
};
