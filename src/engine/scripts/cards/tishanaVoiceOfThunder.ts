// `Tishana, Voice of Thunder` - a static cdaCount, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TISHANA_VOICE_OF_THUNDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(TISHANA_VOICE_OF_THUNDER, "Tishana's power and toughness are each equal to the number of cards in your hand.\nYou have no maximum hand size.\nWhen Tishana enters, draw a card for each creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw a card for each creature you control.", TISHANA_VOICE_OF_THUNDER.name);
const VOCAB_T_L2 = vocabularyTargets("Draw a card for each creature you control.");

// "cards in your hand", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  return (ctx.state.zones.hand[me.controller] ?? []).length;
}


export const TISHANA_VOICE_OF_THUNDER_SCRIPT: CardScript = {
  oracleId: TISHANA_VOICE_OF_THUNDER.oracleId,
  name: TISHANA_VOICE_OF_THUNDER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Tishana, Voice of Thunder - Draw a card for each creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
