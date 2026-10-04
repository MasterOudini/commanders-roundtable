// `Leech Collector // Bloodletting` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEECH_COLLECTOR_BLOODLETTING } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(LEECH_COLLECTOR_BLOODLETTING, "Whenever you gain life for the first time each turn, this creature becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nEach opponent loses 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ becomes prepared.", LEECH_COLLECTOR_BLOODLETTING.name);
const VOCAB_T_L0 = vocabularyTargets("~ becomes prepared.");

export const LEECH_COLLECTOR_BLOODLETTING_SCRIPT: CardScript = {
  oracleId: LEECH_COLLECTOR_BLOODLETTING.oracleId,
  name: LEECH_COLLECTOR_BLOODLETTING.name,
  triggers: [
    {
      abilityId: 'youGainLife-0', face: 0,
      text: LINES[0] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self) && ctx.state.turn.memory.gainedLife[ev.player] !== true,
      label: () => "Leech Collector // Bloodletting - ~ becomes prepared.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
