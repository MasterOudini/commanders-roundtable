// `Gavony Silversmith` - plusCounter on "put a +1/+1 counter on each of up to two target creatures", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { GAVONY_SILVERSMITH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GAVONY_SILVERSMITH, "When this creature enters, put a +1/+1 counter on each of up to two target creatures.");
const TEXT = PRINTED;

export const GAVONY_SILVERSMITH_SCRIPT: CardScript = {
  oracleId: GAVONY_SILVERSMITH.oracleId,
  name: GAVONY_SILVERSMITH.name,
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
      label: () => "Gavony Silversmith - put a +1/+1 counter on each of up to two target creatures",
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
