// `Nebelgast Intruder` - pump on "up to one target creature an opponent controls gets -2/-0 until end of turn", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { NEBELGAST_INTRUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEBELGAST_INTRUDER, "Flash\nFlying\nWhen this creature enters, up to one target creature an opponent controls gets -2/-0 until end of turn.");
const TEXT = PRINTED.split('\n')[2] as string;

export const NEBELGAST_INTRUDER_SCRIPT: CardScript = {
  oracleId: NEBELGAST_INTRUDER.oracleId,
  name: NEBELGAST_INTRUDER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => "Nebelgast Intruder - up to one target creature an opponent controls gets -2/-0 until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
