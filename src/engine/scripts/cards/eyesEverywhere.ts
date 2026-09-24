// `Eyes Everywhere` - a upkeep trigger scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EYES_EVERYWHERE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EYES_EVERYWHERE, "At the beginning of your upkeep, scry 1.\n{5}{U}: Exchange control of this enchantment and target nonland permanent. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exchange control of this enchantment and target nonland permanent.", EYES_EVERYWHERE.name);
const VOCAB_T_A0 = vocabularyTargets("Exchange control of this enchantment and target nonland permanent.");

export const EYES_EVERYWHERE_SCRIPT: CardScript = {
  oracleId: EYES_EVERYWHERE.oracleId,
  name: EYES_EVERYWHERE.name,
  activated: [
    {
      ref: `${EYES_EVERYWHERE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Eyes Everywhere - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Eyes Everywhere - scry 1" } },
        ];
      },
    },
  ],
};
