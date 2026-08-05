import type { ClientSession } from '../client';
import type { Intent } from '../../engine/types/intents';
import type { TestTable } from './table';
import { planTargets } from '../../bot/targets';

// Extracted so a measurement harness can reuse the same script the tests use.
//
// ⚠️ `planTargets` MOVED to `src/bot/targets.ts` and is imported rather than
// copied. Its rule is D102's — targets are matched to clauses ONE FOR ONE, so
// "the first N legal choices" is rejected whenever two picks answer the same
// clause — and two copies of a rule that subtle will drift. Called here with no
// view, which keeps the "first legal" ordering this driver has always had.

/**
 * Answer whatever the game is waiting for, from the acting client's own view.
 *
 * ⚠️ It ATTACKS and it CASTS. A script that only passed priority and played
 * lands never produced combat state, damage, a stack, a death or commander
 * damage — so it exercised about a third of the projection and none of the parts
 * where a patch is most likely to be wrong.
 */
export function simplestIntent(
  session: ClientSession,
  snapshot: ReturnType<ClientSession['snapshot']>,
): Intent | null {
  const awaiting = snapshot.awaiting;
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan': {
        const p = awaiting.players[0];
        return p === snapshot.you ? { t: 'MulliganDecision', player: p, keep: true } : null;
      }
      case 'declareAttackers': {
        if (awaiting.player !== snapshot.you) return null;
        const view = session.currentView();
        const mine = view.zones[`bf:${snapshot.you}`] ?? [];
        const defender = view.seatOrder.find((p) => p !== snapshot.you && !view.seats[p]?.lost);
        const attackers = defender
          ? mine
              .filter((id) => {
                const card = view.cards[id];
                return card && card.power !== null && !card.tapped && !card.summoningSick;
              })
              .map((id) => ({ card: id, defender: { kind: 'player' as const, id: defender } }))
          : [];
        return { t: 'DeclareAttackers', player: awaiting.player, attackers };
      }
      case 'declareBlockers': {
        const p = awaiting.players.find((x) => !awaiting.submitted.includes(x));
        return p === snapshot.you ? { t: 'DeclareBlockers', player: p, blocks: [] } : null;
      }
      case 'chooseLegendKeep': {
        const keep = awaiting.candidates[0];
        return awaiting.player === snapshot.you && keep
          ? { t: 'ChooseLegendKeep', player: awaiting.player, keep }
          : null;
      }
      case 'commanderZoneChoice':
        return awaiting.player === snapshot.you
          ? { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: true }
          : null;
      case 'orderTriggers':
        return awaiting.player === snapshot.you
          ? { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] }
          : null;
      /**
       * ⚠️ The same repair as `chooseTargets` below, made BEFORE the wedge
       * rather than after it. This driver is the one D102 caught with no case
       * for a prompt that had just been added, and `two-instance.cjs` reported
       * it as `host t?` for weeks. Declining is the answer that runs no script
       * and therefore cannot be rejected by a board this driver never inspects.
       */
      case 'optionalTrigger':
        return awaiting.player === snapshot.you
          ? { t: 'AnswerOptionalTrigger', player: awaiting.player, stackId: awaiting.stackId, accept: false }
          : null;
      /**
       * ⚠️ Added WITH the prompt (D136), not after a sign-off went quiet. This
       * driver plays lands, and a shock land in a deck it drives would fall to
       * `default: return null` and stop the run — the same wedge twice above,
       * and the reason `two-instance.cjs` cannot be trusted to notice: it stops
       * on a RESOLVED SPELL, so a land drop that wedged before the first cast
       * reads as a slow shuffle rather than as a bug.
       *
       * Declining, because it is the answer the handler cannot reject: paying
       * re-checks a life total this driver never inspects.
       */
      /** Any colour is legal on any board; white, for reproducibility. */
      case 'chooseReplacement':
        return awaiting.player === snapshot.you && awaiting.options[0]
          ? { t: 'AnswerChooseReplacement', player: awaiting.player, key: awaiting.options[0].key }
          : null;
      case 'chooseColor':
        return awaiting.player === snapshot.you
          ? { t: 'AnswerChooseColor', player: awaiting.player, color: 'W' }
          : null;
      case 'entersChoice':
        return awaiting.player === snapshot.you
          ? { t: 'AnswerEntersChoice', player: awaiting.player, source: awaiting.source, pay: false }
          : null;
      /**
       * ⚠️ **THE PROMPT CARRIES NO CANDIDATES, so this driver has to read the
       * VIEW** — which is the whole point of D137's design: a hand is hidden, so
       * the answer comes from the one place that legitimately holds it. A driver
       * that could answer from the prompt alone would be a driver holding a hand
       * it should not have.
       */
      /** The revealed set as it stands (D142) — always legal, never a guess. */
      case 'orderCards':
        return awaiting.player === snapshot.you
          ? { t: 'AnswerOrderCards', player: awaiting.player, cards: [...(session.currentView().peek ?? [])] }
          : null;
      case 'chooseFromZone': {
        if (awaiting.player !== snapshot.you) return null;
        const v = session.currentView();
        // Two zones (D141): a library offers only what was just revealed.
        const hand =
          awaiting.zone === 'library' ? (v.peek ?? []) : (v.zones[`hand:${awaiting.player}`] ?? []);
        // Fewer than asked is a rejection rather than a wedge, and the engine
        // does not raise this unless the hand is bigger than the count.
        return { t: 'AnswerChooseFromZone', player: awaiting.player, cards: hand.slice(0, awaiting.count) };
      }
      /**
       * ⚠️ Without this the script WEDGES, and it looks like a desync rather than
       * a gap. The targeting work added this prompt; `simplestIntent` casts
       * spells, so the first targeted spell it cast fell to `default: return
       * null` and nothing was ever submitted again. `two-instance.cjs` then
       * failed three checks whose output reads `host t?` — that `?` was this
       * function having no answer, not the two apps disagreeing.
       */
      case 'chooseTargets': {
        if (awaiting.player !== snapshot.you) return null;
        const targets = planTargets(session, awaiting.source, awaiting.specs);
        // The board can change between choosing to cast and being asked (another
        // player responds, something dies). Abandoning is the terminating answer;
        // returning null here would be the wedge this case exists to remove.
        return targets
          ? { t: 'ChooseTargets', player: awaiting.player, targets }
          : { t: 'CancelPendingCast', player: awaiting.player };
      }
      default:
        return null;
    }
  }
  if (snapshot.priority !== snapshot.you) return null;
  const land = snapshot.legal.find((a) => a.t === 'PlayLand');
  if (land?.t === 'PlayLand') return { t: 'PlayLand', player: snapshot.you, card: land.card, faceIndex: land.faceIndex };
  /**
   * ⚠️ Skipping an untargetable spell is what stops the `CancelPendingCast` above
   * becoming a LIVELOCK. `legalActions` does not check targets at all — it offers
   * Swords to Plowshares with an empty board — so without this the script would
   * cast, be asked, cancel, and cast the same card again forever. That burns the
   * loop's budget without advancing a turn, which fails exactly the same three
   * checks as the wedge it replaced.
   *
   * Deliberately the same shape as the `!a.hasX` filter beside it: the script
   * declines what it has no simple answer for rather than guessing badly.
   */
  const cast = snapshot.legal.find(
    (a) =>
      a.t === 'CastSpell' &&
      a.affordable &&
      !a.hasX &&
      planTargets(session, a.card, session.targetSpecsFor(a.card)) !== null,
  );
  if (cast?.t === 'CastSpell') {
    // ⚠️ Through `previewCast`, not a bare `CastSpell`. That is the path a real
    // player takes, and it is the one that proves the client's solver and the
    // host's validator agree about a plan built from a `SolveInput` off the wire.
    const preview = session.previewCast(cast.card, 0);
    if (preview?.plan) {
      return { t: 'CastSpell', player: snapshot.you, card: cast.card, faceIndex: cast.faceIndex, plan: preview.plan };
    }
  }
  return { t: 'PassPriority', player: snapshot.you };
}

/**
 * Play the game forward using ONLY what each client can see.
 *
 * ⚠️ Every intent comes from the client whose seat it names, chosen from that
 * client's own `legalActions`. A script that drove the game from the host's
 * state would prove the engine works and nothing at all about the wire.
 */
export function playFrom(table: TestTable, steps: number): number {
  let acted = 0;
  for (let i = 0; i < steps; i++) {
    let moved = false;
    for (const client of table.clients) {
      const snapshot = client.session.snapshot();
      if (snapshot.finished) return acted;
      const intent = simplestIntent(client.session, snapshot);
      if (!intent) continue;
      client.session.submit(intent);
      acted++;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return acted;
}

