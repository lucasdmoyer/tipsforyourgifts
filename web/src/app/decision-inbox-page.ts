import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CopyTextButtonComponent } from './copy-text-button';
import { SeoService } from './seo.service';
import { STUDIO_DATA, STUDIO_DATA_PROVIDER } from './studio-data';

@Component({
  imports: [CopyTextButtonComponent, RouterLink],
  providers: [STUDIO_DATA_PROVIDER],
  template: `
    <section class="shell studio-hero decision-hero">
      <p class="eyebrow">Founder decision inbox</p>
      <h1>{{ content.operations.founderAgenda.decisions.length }} calls. One order.</h1>
      <p class="lede">The team prepares the evidence, the exact action, and the downside. Lucas decides where authority begins. Nothing on this page merges, spends, publishes, enrolls, or deploys by itself.</p>
      <div class="studio-command-actions">
        <a class="button secondary" routerLink="/studio">Open full operating room</a>
        <a class="button secondary" routerLink="/studio/brief">Give the team a direction</a>
      </div>
    </section>

    <section class="shell compact-section">
      <div class="decision-metrics" aria-label="Executive decision summary">
        <div><strong>{{ content.operations.founderAgenda.decisions.length }}</strong><span>ranked calls</span></div>
        <div><strong>{{ content.operations.editorialReview.counts.pendingBundles }}</strong><span>sensitive drafts</span></div>
        <div><strong>{{ content.operations.automationReadiness.counts.founderActions }}</strong><span>founder actions</span></div>
        <div><strong>{{ content.operations.growth.snapshotCount }}</strong><span>measurement baselines</span></div>
      </div>
      <p class="decision-boundary"><strong>Evidence posture:</strong> profitability is {{ displayStatus(content.operations.founderAgenda.profitabilityEvidence) }}. Missing traffic, conversion, and revenue remain unknown—not zero.</p>
    </section>

    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Board agenda</p><h2>Decide from the top.</h2></div>
        <p>Ranked from versioned operating evidence. Each action preserves its own authority boundary.</p>
      </div>
      <div class="decision-board">
        @for (decision of content.operations.founderAgenda.decisions; track decision.id) {
          <article class="panel decision-card" [class.decision-primary]="decision.rank === 1">
            <div class="experiment-header">
              <p class="eyebrow">Decision {{ decision.rank }} · {{ displayStatus(decision.category) }}</p>
              <span class="status">{{ displayStatus(decision.horizon) }}</span>
            </div>
            <h3>{{ decision.title }}</h3>
            <p class="agenda-recommendation"><strong>Team recommendation:</strong> {{ decision.recommendation }}</p>
            <p><strong>The call:</strong> {{ decision.decisionQuestion }}</p>
            <div class="decision-proof">
              <p><strong>Why now:</strong> {{ decision.rationale }}</p>
              <p><strong>What it unlocks:</strong> {{ decision.unlocks }}</p>
              <p><strong>Cost of the call:</strong> {{ decision.tradeoff }}</p>
            </div>
            <p class="agenda-guardrail"><strong>Guardrail:</strong> {{ decision.guardrail }}</p>
            <div class="actions">
              <a class="button" [href]="decision.action.url" target="_blank" rel="noopener">{{ decision.action.label }}</a>
              <details>
                <summary>Show evidence and exact action</summary>
                <ul>@for (item of decision.evidence; track item) { <li>{{ item }}</li> }</ul>
                @if (decision.action.command; as exactAction) {
                  <div class="command">{{ exactAction }}</div>
                  <tfg-copy-text-button [value]="exactAction" />
                }
              </details>
            </div>
          </article>
        }
      </div>
    </section>

    <section class="shell compact-section editorial-decision-queue">
      <div class="section-heading">
        <div><p class="eyebrow">Sensitive editorial calls</p><h2>Read the language before approving it.</h2></div>
        <p>A founder safety decision applies only to the exact hashes shown in the source record. Fresh independent QA still follows.</p>
      </div>
      @if (content.operations.editorialReview.queue.length > 0) {
        <div class="decision-board editorial-review-grid">
          @for (review of content.operations.editorialReview.queue; track review.runId) {
            <article class="panel decision-card editorial-review-card">
              <div class="experiment-header">
                <p class="eyebrow">{{ review.ideaId }} · {{ review.articleSlug }}</p>
                <span class="status blocked_on_account">{{ displayStatus(review.founderSafetyReviewStatus) }}</span>
              </div>
              <h3>Founder language review, then independent QA</h3>
              @for (claim of review.highRiskClaims; track claim.id) {
                <div class="editorial-claim">
                  <p><strong>{{ claim.id }}</strong></p>
                  <p>{{ claim.text }}</p>
                  <p class="quiet">Sources: {{ claim.sourceIds.join(', ') }}</p>
                </div>
              }
              @if (review.founderDecisionPacket && (review.founderSafetyReviewStatus === 'approval_required' || review.founderSafetyReviewStatus === 'stale')) {
                <div class="actions">
                  <a class="button" [href]="review.founderDecisionPacket.approvalIssueUrl" target="_blank" rel="noopener">Review and approve exact language</a>
                  <a class="button secondary" [href]="review.founderDecisionPacket.rejectionIssueUrl" target="_blank" rel="noopener">Reject exact language</a>
                </div>
              }
              <details open>
                <summary>Decision boundary and exact actions</summary>
                <ul>@for (blocker of review.blockers; track blocker) { <li>{{ blocker }}</li> }</ul>
                @if (review.founderDecisionPacket) {
                  <p>The phone-friendly issue packets above bind the same exact hashes and require every authority acknowledgement. Command-line recovery remains available below.</p>
                  <p><strong>Approve exact language</strong></p>
                  <div class="command">{{ review.founderDecisionPacket.approveCommand }}</div>
                  <tfg-copy-text-button [value]="review.founderDecisionPacket.approveCommand" label="Copy approval" />
                  <p><strong>Reject exact language</strong></p>
                  <div class="command">{{ review.founderDecisionPacket.rejectCommand }}</div>
                  <tfg-copy-text-button [value]="review.founderDecisionPacket.rejectCommand" label="Copy rejection" />
                  <p class="quiet">{{ review.founderDecisionPacket.authorityBoundary }}</p>
                  <p><a class="button secondary" [href]="review.founderDecisionPacket.workflowUrl" target="_blank" rel="noopener">Open founder safety workflow</a></p>
                }
              </details>
            </article>
          }
        </div>
      } @else {
        <div class="panel"><h3>No sensitive draft is waiting on Lucas.</h3></div>
      }
    </section>

    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Operating gates</p><h2>The machine is honest about what is off.</h2></div>
        <p>These are configuration states, not inferred account status.</p>
      </div>
      <div class="grid two">
        <article class="panel">
          <div class="experiment-header"><p class="eyebrow">AI research team</p><span class="status blocked_on_account">{{ displayStatus(content.operations.aiAutomationPolicy.status) }}</span></div>
          <h3>{{ content.operations.aiAutomationPolicy.activationReady ? 'Bounded automation is ready' : 'Budget and credential controls come first' }}</h3>
          <ul>@for (blocker of content.operations.aiAutomationPolicy.activationBlockers; track blocker) { <li>{{ blocker }}</li> }</ul>
          @if (content.operations.aiAutomationPolicy.budgetConfiguration.available) {
            <p><strong>Recommended ceiling:</strong> &#36;{{ content.operations.aiAutomationPolicy.spendControl.recommendation.monthlyHardLimitUsd }} hard limit · &#36;{{ content.operations.aiAutomationPolicy.spendControl.recommendation.alertThresholdUsd }} alert.</p>
            <p><a class="button secondary" [href]="content.operations.aiAutomationPolicy.budgetConfiguration.workflowUrl" target="_blank" rel="noopener">Open budget-control workflow</a></p>
          }
        </article>
        <article class="panel">
          <div class="experiment-header"><p class="eyebrow">Aggregate measurement</p><span class="status blocked_on_account">{{ displayStatus(content.operations.growth.searchConsole.status) }}</span></div>
          <h3>{{ content.operations.growth.snapshotCount }} complete baseline{{ content.operations.growth.snapshotCount === 1 ? '' : 's' }}</h3>
          <p>Privacy review is {{ displayStatus(content.growth.measurementPolicy.privacyReview.status) }}. Client collection is {{ content.growth.measurementPolicy.privacyReview.clientCollectionEnabled ? 'enabled' : 'disabled' }}. The first baseline is {{ displayStatus(content.growth.measurementPolicy.privacyReview.baselineStatus) }}.</p>
          <p><strong>Next:</strong> verify the exact Search Console URL-prefix property and least-privilege identity evidence before configuration or collection.</p>
          <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/issues/59" target="_blank" rel="noopener">Open measurement packet</a></p>
        </article>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionInboxPage {
  readonly content = inject(STUDIO_DATA);
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.set({
      title: 'Founder decision inbox',
      description: 'Ranked founder decisions, sensitive editorial language, and operating gates for Tips for Your Gifts.',
      path: '/studio/decisions',
      noindex: true
    });
  }

  displayStatus(status: string) {
    return status.replaceAll('_', ' ');
  }
}
