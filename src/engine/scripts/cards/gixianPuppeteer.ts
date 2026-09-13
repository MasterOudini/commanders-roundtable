// `Gixian Puppeteer` - a secondCard trigger drain, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIXIAN_PUPPETEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIXIAN_PUPPETEER, "Whenever you draw your second card each turn, each opponent loses 2 life and you gain 2 life.\nWhen this creature dies, return another target creature card with mana value 3 or less from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return another target creature card with mana value 3 or less from your graveyard to the battlefield.", GIXIAN_PUPPETEER.name);
const VOCAB_T_L1 = vocabularyTargets("Return another target creature card with mana value 3 or less from your graveyard to the battlefield.");

export const GIXIAN_PUPPETEER_SCRIPT: CardScript = {
  oracleId: GIXIAN_PUPPETEER.oracleId,
  name: GIXIAN_PUPPETEER.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: LINES[0] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Gixian Puppeteer - drain",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
        return out;
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Gixian Puppeteer - Return another target creature card with mana value 3 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
