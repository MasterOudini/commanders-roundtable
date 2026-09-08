// `Ray Fillet, Man Ray` - a etb trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAY_FILLET_MAN_RAY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAY_FILLET_MAN_RAY, "Flying\nWhen Ray Fillet enters, create a Mutagen token. (It's an artifact with \"{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.\")\n{2}, Remove a +1/+1 counter from a creature you control: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a Mutagen token.", RAY_FILLET_MAN_RAY.name);
const VOCAB_T_L1 = vocabularyTargets("Create a Mutagen token.");

export const RAY_FILLET_MAN_RAY_SCRIPT: CardScript = {
  oracleId: RAY_FILLET_MAN_RAY.oracleId,
  name: RAY_FILLET_MAN_RAY.name,
  activated: [
    {
      ref: `${RAY_FILLET_MAN_RAY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ray Fillet, Man Ray - Create a Mutagen token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
