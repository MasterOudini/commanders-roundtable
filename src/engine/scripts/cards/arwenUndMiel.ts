// `Arwen Undómiel` - a youScry trigger vocab, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARWEN_UND_MIEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARWEN_UND_MIEL, "Whenever you scry, put a +1/+1 counter on target creature.\n{4}{G}{U}: Scry 2.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", ARWEN_UND_MIEL.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const ARWEN_UND_MIEL_SCRIPT: CardScript = {
  oracleId: ARWEN_UND_MIEL.oracleId,
  name: ARWEN_UND_MIEL.name,
  activated: [
    {
      ref: `${ARWEN_UND_MIEL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Arwen Undómiel - scry 2" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youScry-0',
      text: LINES[0] as string,
      event: 'Scried',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'Scried' && ev.player === ctx.query.controllerOf(self),
      label: () => "Arwen Undómiel - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
