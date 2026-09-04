// `Roaming Ghostlight` - bounce on "return up to one target non-Spirit creature to its owner's hand", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { ROAMING_GHOSTLIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROAMING_GHOSTLIGHT, "Flying\nWhen this creature enters, return up to one target non-Spirit creature to its owner's hand.");
const TEXT = PRINTED.split('\n')[1] as string;

export const ROAMING_GHOSTLIGHT_SCRIPT: CardScript = {
  oracleId: ROAMING_GHOSTLIGHT.oracleId,
  name: ROAMING_GHOSTLIGHT.name,
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
      label: () => "Roaming Ghostlight - return up to one target non-Spirit creature to its owner's hand",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] });
        }
        return out;
      },
    },
  ],
};
