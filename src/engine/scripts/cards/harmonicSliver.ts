// `Harmonic Sliver` - a static anthem, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARMONIC_SLIVER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(HARMONIC_SLIVER, "All Slivers have \"When this permanent enters, destroy target artifact or enchantment.\"");

const VOCAB_L0 = vocabularyEffects("Destroy target artifact or enchantment.", HARMONIC_SLIVER.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target artifact or enchantment.");

const GRANT_0 = grantedTriggerRef(`${HARMONIC_SLIVER.oracleId}#gt0`, HARMONIC_SLIVER.name);

export const HARMONIC_SLIVER_SCRIPT: CardScript = {
  oracleId: HARMONIC_SLIVER.oracleId,
  name: HARMONIC_SLIVER.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Harmonic Sliver - Destroy target artifact or enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
