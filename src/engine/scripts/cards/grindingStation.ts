// `Grinding Station` - an activation vocab, a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRINDING_STATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRINDING_STATION, "{T}, Sacrifice an artifact: Target player mills three cards.\nWhenever an artifact enters, you may untap this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player mills three cards.", GRINDING_STATION.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills three cards.");
const VOCAB_L1 = vocabularyEffects("Untap this artifact.", GRINDING_STATION.name);
const VOCAB_T_L1 = vocabularyTargets("Untap this artifact.");

export const GRINDING_STATION_SCRIPT: CardScript = {
  oracleId: GRINDING_STATION.oracleId,
  name: GRINDING_STATION.name,
  activated: [
    {
      ref: `${GRINDING_STATION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Grinding Station - Untap this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
