// `Constricting Sliver` - a static anthem, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CONSTRICTING_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CONSTRICTING_SLIVER, "Sliver creatures you control have \"When this creature enters, you may exile target creature an opponent controls until this creature leaves the battlefield.\"");

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until ~ leaves the battlefield.", CONSTRICTING_SLIVER.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until ~ leaves the battlefield.");

const GRANT_0 = grantedTriggerRef(`${CONSTRICTING_SLIVER.oracleId}#gt0`, CONSTRICTING_SLIVER.name);

export const CONSTRICTING_SLIVER_SCRIPT: CardScript = {
  oracleId: CONSTRICTING_SLIVER.oracleId,
  name: CONSTRICTING_SLIVER.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Constricting Sliver - Exile target creature an opponent controls until ~ leaves the battlefield.",
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
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
