// `Grafted Growth` - a etb trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAFTED_GROWTH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
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

const PRINTED = printed(GRAFTED_GROWTH, "Enchant land\nWhen this Aura enters, put a +1/+1 counter on target creature or Vehicle you control.\nEnchanted land has \"{T}: Add two mana of any one color.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature or Vehicle you control.", GRAFTED_GROWTH.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature or Vehicle you control.");

const GRANT_2 = grantedMana("{T}: Add two mana of any one color.", GRAFTED_GROWTH.name);

export const GRAFTED_GROWTH_SCRIPT: CardScript = {
  oracleId: GRAFTED_GROWTH.oracleId,
  name: GRAFTED_GROWTH.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Grafted Growth - Put a +1/+1 counter on target creature or Vehicle you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_2);
      },
    },
  ],
};
