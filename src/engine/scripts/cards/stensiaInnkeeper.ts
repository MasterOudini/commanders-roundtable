// `Stensia Innkeeper` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STENSIA_INNKEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STENSIA_INNKEEPER, "When this creature enters, tap target land an opponent controls. That land doesn't untap during its controller's next untap step.");

const VOCAB_L0 = vocabularyEffects("Tap target land an opponent controls. That land doesn't untap during its controller's next untap step.", STENSIA_INNKEEPER.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target land an opponent controls. That land doesn't untap during its controller's next untap step.");

export const STENSIA_INNKEEPER_SCRIPT: CardScript = {
  oracleId: STENSIA_INNKEEPER.oracleId,
  name: STENSIA_INNKEEPER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Stensia Innkeeper - Tap target land an opponent controls. That land doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
