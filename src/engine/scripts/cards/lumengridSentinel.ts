// `Lumengrid Sentinel` - a artifactEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUMENGRID_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUMENGRID_SENTINEL, "Flying\nWhenever an artifact you control enters, you may tap target permanent.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap target permanent.", LUMENGRID_SENTINEL.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target permanent.");

export const LUMENGRID_SENTINEL_SCRIPT: CardScript = {
  oracleId: LUMENGRID_SENTINEL.oracleId,
  name: LUMENGRID_SENTINEL.name,
  triggers: [
    {
      abilityId: 'artifactEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Lumengrid Sentinel - Tap target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
