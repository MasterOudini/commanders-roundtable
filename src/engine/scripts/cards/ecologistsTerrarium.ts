// `Ecologist's Terrarium` - a etb trigger vocab, an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ECOLOGIST_S_TERRARIUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ECOLOGIST_S_TERRARIUM, "When this artifact enters, you may search your library for a basic land card, reveal it, put it into your hand, then shuffle.\n{2}, {T}, Sacrifice this artifact: Put a +1/+1 counter on target creature. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", ECOLOGIST_S_TERRARIUM.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.");

export const ECOLOGISTS_TERRARIUM_SCRIPT: CardScript = {
  oracleId: ECOLOGIST_S_TERRARIUM.oracleId,
  name: ECOLOGIST_S_TERRARIUM.name,
  activated: [
    {
      ref: `${ECOLOGIST_S_TERRARIUM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ecologist's Terrarium - Search your library for a basic land card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
