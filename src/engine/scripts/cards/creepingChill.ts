// `Creeping Chill` — "Creeping Chill deals 3 damage to each opponent and
// you gain 3 life.\nWhen Creeping Chill is put into your graveyard from your
// library, you may exile it. If you do, Creeping Chill deals 3 damage to
// each opponent and you gain 3 life."
//
// ⚠️ TWO FIRSTS ON ONE CARD, both measured by its test rather than assumed.
// (1) The FIRST script trigger with `optional: true` — the engine has asked
// "may" triggers through `optionalTrigger` since D128 (loop.ts raises it,
// `AnswerOptionalTrigger` answers it) but no script def had ever set the
// flag. (2) The FIRST watcher whose active zone is the GRAVEYARD: the card
// triggers on ITSELF arriving there from the library, so the def is asked
// of the post-event state, where the card already sits in the graveyard —
// no looksBack. The spell def claims line 1, the trigger claims line 2.
// "If you do" is read at resolution: the card must still be in the
// graveyard to be exiled, or nothing else happens. D274.

import { CREEPING_CHILL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  CREEPING_CHILL,
  'Creeping Chill deals 3 damage to each opponent and you gain 3 life.\nWhen Creeping Chill is put into your graveyard from your library, you may exile it. If you do, Creeping Chill deals 3 damage to each opponent and you gain 3 life.',
);
const SPELL = PRINTED.split('\n')[0] as string;
const FROM_LIBRARY = PRINTED.split('\n')[1] as string;

/** 3 to each opponent still in the game, then 3 life for me. */
function chill(ctx: ScriptCtx, self: InstanceId, controller: string): readonly EventBody[] {
  const damages = [];
  for (const [id, p] of Object.entries(ctx.state.players)) {
    if (id === controller || !p || p.hasLost) continue;
    damages.push({
      source: self,
      target: { kind: 'player' as const, id },
      amount: 3,
      deathtouch: false,
      lifelinkTo: null,
      isCommanderDamage: false,
      viaTrample: 0,
      toxic: 0,
      applyAs: 'normal' as const,
    });
  }
  const events: EventBody[] = [];
  if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
  const me = ctx.state.players[controller];
  if (me && !me.hasLost) events.push({ t: 'LifeChanged', player: controller, delta: 3, to: me.life + 3 });
  return events;
}

export const CREEPING_CHILL_SCRIPT: CardScript = {
  oracleId: CREEPING_CHILL.oracleId,
  name: CREEPING_CHILL.name,
  spell: {
    text: SPELL,
    resolve: (ctx, self, obj): readonly EventBody[] => chill(ctx, self, obj.controller),
  },
  triggers: [
    {
      abilityId: 'from-library',
      text: FROM_LIBRARY,
      event: 'CardsMoved',
      activeZones: ['graveyard'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.card === self &&
            m.from.kind === 'library' &&
            m.to.kind === 'graveyard' &&
            m.to.player === ctx.state.cards[self]?.owner,
        ),
      label: () => 'Creeping Chill — exile it: 3 damage to each opponent, you gain 3 life',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const card = ctx.state.cards[self];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: self,
                from: { kind: 'graveyard', player: card.zone.player },
                to: { kind: 'exile', player: card.owner },
              },
            ],
          },
          ...chill(ctx, self, obj.controller),
        ];
      },
    },
  ],
};
