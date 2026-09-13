// `Grixis Battlemage` - an activation loot, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRIXIS_BATTLEMAGE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(GRIXIS_BATTLEMAGE, "{U}, {T}: Draw a card, then discard a card.\n{R}, {T}: Target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature can't block this turn.", GRIXIS_BATTLEMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature can't block this turn.");

export const GRIXIS_BATTLEMAGE_SCRIPT: CardScript = {
  oracleId: GRIXIS_BATTLEMAGE.oracleId,
  name: GRIXIS_BATTLEMAGE.name,
  activated: [
    {
      ref: `${GRIXIS_BATTLEMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Grixis Battlemage - discard a card" } },
        ];
      },
    },
    {
      ref: `${GRIXIS_BATTLEMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
