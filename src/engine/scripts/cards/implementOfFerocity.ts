// `Implement of Ferocity` - an activation counterOnTarget, a auraToGraveyard trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMPLEMENT_OF_FEROCITY } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(IMPLEMENT_OF_FEROCITY, "{G}, Sacrifice this artifact: Put a +1/+1 counter on target creature. Activate only as a sorcery.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.");
const LINES = PRINTED.split('\n');

export const IMPLEMENT_OF_FEROCITY_SCRIPT: CardScript = {
  oracleId: IMPLEMENT_OF_FEROCITY.oracleId,
  name: IMPLEMENT_OF_FEROCITY.name,
  activated: [
    {
      ref: `${IMPLEMENT_OF_FEROCITY.oracleId}#a0`,
      text: LINES[0] as string,
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
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Implement of Ferocity - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
