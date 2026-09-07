// `Irreverent Revelers` - a etb trigger vocab, a etb trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRREVERENT_REVELERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(IRREVERENT_REVELERS, "When this creature enters, choose one —\n• Destroy target artifact.\n• This creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Destroy target artifact.", targets: vocabularyTargets("Destroy target artifact.") },
  { text: "This creature gains haste until end of turn.", targets: vocabularyTargets("~ gains haste until end of turn.") },
];

const VOCAB_L0_m0 = vocabularyEffects("Destroy target artifact.", IRREVERENT_REVELERS.name);
const VOCAB_T_L0_m0 = vocabularyTargets("Destroy target artifact.");

export const IRREVERENT_REVELERS_SCRIPT: CardScript = {
  oracleId: IRREVERENT_REVELERS.oracleId,
  name: IRREVERENT_REVELERS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Irreverent Revelers - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L0_m0, VOCAB_T_L0_m0);
        }
        if (chosen === 1) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
        }
        return [];
      },
    },
  ],
};
