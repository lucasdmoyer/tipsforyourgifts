import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, InjectionToken } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Growth, Operations, Strategy, StrategyIdea } from './content.types';
import { assessFounderBrief, buildFounderBriefMarkdown, buildStrategyIssueUrl, EMPTY_FOUNDER_BRIEF, type FounderBriefDraft } from './founder-brief';
import { SeoService } from './seo.service';

export interface StudioData {
  operations: Operations;
  strategy: Strategy;
  growth: Growth;
}

export const STUDIO_DATA = new InjectionToken<StudioData>('STUDIO_DATA');

@Component({
  imports: [DatePipe, RouterLink],
  providers: [{
    provide: STUDIO_DATA,
    useFactory: () => inject(ActivatedRoute).snapshot.data['studioData'] as StudioData
  }],
  template: `
    <section class="shell studio-hero">
      <p class="eyebrow">Executive studio</p><h1>Set the direction. Let the system run.</h1>
      <p class="lede">This is the strategy and control surface generated from versioned operating data. It is intentionally no-index and contains no credentials or private customer data.</p>
    </section>
    <section id="automation-readiness" class="shell compact-section automation-readiness">
      <div class="section-heading">
        <div><p class="eyebrow">AI team readiness</p><h2>What can run. What needs Lucas.</h2></div>
        <p>{{ content.operations.automationReadiness.summary }}</p>
      </div>
      <div class="readiness-summary" aria-label="Automation readiness summary">
        <div><strong>{{ content.operations.automationReadiness.counts.ready }}</strong><span>fully ready</span></div>
        <div><strong>{{ content.operations.automationReadiness.counts.limited }}</strong><span>limited or fallback</span></div>
        <div><strong>{{ content.operations.automationReadiness.counts.blocked }}</strong><span>blocked</span></div>
        <div><strong>{{ content.operations.automationReadiness.counts.founderActions }}</strong><span>need founder action</span></div>
      </div>
      <p class="readiness-snapshot"><strong>Evidence snapshot:</strong> {{ content.operations.automationReadiness.observedAt | date: 'MMMM d, y, h:mm a': 'UTC' }} UTC. This is versioned operating evidence, not a live account poll.</p>
      <article class="panel ai-policy-card">
        <div class="experiment-header"><div><p class="eyebrow">AI authority and spend</p><h3>Six workflows. Eight model calls. Zero production authority.</h3></div><span class="status" [class.blocked_on_account]="!content.operations.aiAutomationPolicy.activationReady" [class.approved_for_research]="content.operations.aiAutomationPolicy.activationReady">{{ displayStatus(content.operations.aiAutomationPolicy.status) }}</span></div>
        <p>The model jobs can draft inside the repository with read-only GitHub permissions. Separate writer jobs may open proposal pull requests, but they never receive the OpenAI key. The model cannot deploy Firebase, activate affiliate links, publish social posts, send email, or create credentials.</p>
        <div class="readiness-summary" aria-label="AI policy summary">
          <div><strong>{{ content.operations.aiAutomationPolicy.protectedWorkflows }}</strong><span>protected workflows</span></div>
          <div><strong>{{ content.operations.aiAutomationPolicy.protectedModelCalls }}</strong><span>bounded model steps</span></div>
          <div><strong>{{ content.operations.aiAutomationPolicy.spendControl.monthlyBudgetUsd === null ? '—' : ('$' + content.operations.aiAutomationPolicy.spendControl.monthlyBudgetUsd) }}</strong><span>monthly platform budget</span></div>
          <div><strong>{{ content.operations.aiAutomationPolicy.activationReady ? 'Yes' : 'No' }}</strong><span>activation ready</span></div>
        </div>
        <p><strong>Current stop:</strong> A real OpenAI project monthly budget and platform evidence must be recorded before the policy can become active or a credential can be used.</p>
        <details><summary>Activation blockers and shutdown rules</summary><p><strong>Activation blockers</strong></p><ul>@for (blocker of content.operations.aiAutomationPolicy.activationBlockers; track blocker) { <li>{{ blocker }}</li> }</ul><p><strong>Automatic or founder shutdown conditions</strong></p><ul>@for (condition of content.operations.aiAutomationPolicy.shutdownConditions; track condition) { <li>{{ condition }}</li> }</ul><p><a [href]="content.operations.aiAutomationPolicy.runtime.documentationUrl" target="_blank" rel="noopener">Open Codex GitHub Action documentation →</a></p></details>
      </article>
      <div class="readiness-grid">
        @for (team of content.operations.automationReadiness.teams; track team.id) {
          <article class="readiness-card">
            <div class="experiment-header"><p class="eyebrow">{{ team.label }}</p><span class="status" [class.blocked_on_account]="team.status.startsWith('blocked') || team.status === 'founder_approval_required'" [class.approved_for_research]="team.status === 'ready'">{{ displayStatus(team.status) }}</span></div>
            <p>{{ team.evidence }}</p>
            <p class="readiness-next"><strong>Next:</strong> {{ team.nextAction }}</p>
            @if (team.actionUrl) { <p><a [href]="team.actionUrl" target="_blank" rel="noopener">Open exact evidence or action →</a></p> }
          </article>
        }
      </div>
      <div class="grid two readiness-evidence">
        <div class="panel">
          <p class="eyebrow">External configuration</p>
          <h3>Three bounded infrastructure gates.</h3>
          @for (gate of content.operations.automationReadiness.externalGates; track gate.id) {
            <details>
              <summary>{{ gate.label }} · {{ displayStatus(gate.status) }}</summary>
              <p>{{ gate.summary }}</p>
              <p><strong>Founder action:</strong> {{ gate.nextAction }}</p>
              <p><strong>Authority boundary:</strong> {{ gate.authorityBoundary }}</p>
              <p><a [href]="gate.evidenceUrl" target="_blank" rel="noopener">Open issue</a> · <a [href]="gate.diagnosticUrl" target="_blank" rel="noopener">Open diagnostic evidence</a></p>
            </details>
          }
        </div>
        <div class="panel release-candidate-card">
          <div class="experiment-header"><p class="eyebrow">Exact release candidate</p><span class="status">{{ displayStatus(content.operations.automationReadiness.releaseCandidate.status) }}</span></div>
          <h3>{{ content.operations.automationReadiness.releaseCandidate.sha.slice(0, 7) }}</h3>
          <p>{{ content.operations.automationReadiness.releaseCandidate.summary }}</p>
          <p><strong>Next:</strong> {{ content.operations.automationReadiness.releaseCandidate.nextAction }}</p>
          <p><a [href]="content.operations.automationReadiness.releaseCandidate.previewUrl" target="_blank" rel="noopener">Open exact Firebase preview</a> · <a [href]="content.operations.automationReadiness.releaseCandidate.reviewUrl" target="_blank" rel="noopener">Open review evidence</a></p>
        </div>
      </div>
    </section>
    <section class="shell compact-section"><div class="kpi-grid">
      @for (kpi of kpis; track kpi.label) { <div class="kpi"><strong>{{ kpi.value }}</strong><span>{{ kpi.label }}</span></div> }
    </div></section>
    <section class="shell compact-section founder-agenda">
      <div class="section-heading">
        <div><p class="eyebrow">Founder agenda</p><h2>{{ content.operations.founderAgenda.decisions.length }} decision{{ content.operations.founderAgenda.decisions.length === 1 ? '' : 's' }}. One clear order.</h2></div>
        <p>Ranked from versioned operating evidence—not revenue guesses. Profitability remains {{ displayStatus(content.operations.founderAgenda.profitabilityEvidence) }}.</p>
      </div>
      @for (decision of content.operations.founderAgenda.decisions; track decision.id) {
        @if (decision.rank === 1) {
          <article class="panel agenda-primary">
            <div class="experiment-header"><p class="eyebrow">Decision {{ decision.rank }} · {{ displayStatus(decision.category) }}</p><span class="status">{{ displayStatus(decision.horizon) }}</span></div>
            <h2>{{ decision.title }}</h2>
            <p class="agenda-recommendation"><strong>Team recommendation:</strong> {{ decision.recommendation }}</p>
            <p class="lede">{{ decision.decisionQuestion }}</p>
            <div class="agenda-proof-grid">
              <div><strong>Why now</strong><p>{{ decision.rationale }}</p></div>
              <div><strong>What it unlocks</strong><p>{{ decision.unlocks }}</p></div>
              <div><strong>Tradeoff</strong><p>{{ decision.tradeoff }}</p></div>
            </div>
            <p><strong>Current evidence:</strong></p><ul>@for (item of decision.evidence; track item) { <li>{{ item }}</li> }</ul>
            <p class="agenda-guardrail"><strong>Guardrail:</strong> {{ decision.guardrail }} <span>Reversibility: {{ decision.reversibility }}.</span></p>
            <p><a class="button" [href]="decision.action.url" target="_blank" rel="noopener">{{ decision.action.label }}</a></p>
            @if (decision.action.command) { <details><summary>Exact founder command</summary><div class="command">{{ decision.action.command }}</div></details> }
          </article>
        }
      }
      <div class="experiment-grid agenda-grid">
        @for (decision of content.operations.founderAgenda.decisions; track decision.id) {
          @if (decision.rank > 1) {
            <article class="experiment-card agenda-card">
              <div class="experiment-header"><p class="eyebrow">Decision {{ decision.rank }} · {{ displayStatus(decision.category) }}</p><span class="status">{{ displayStatus(decision.horizon) }}</span></div>
              <h3>{{ decision.title }}</h3>
              <p><strong>Recommendation:</strong> {{ decision.recommendation }}</p>
              <p>{{ decision.rationale }}</p>
              <details><summary>Open decision evidence</summary><p><strong>Question:</strong> {{ decision.decisionQuestion }}</p><ul>@for (item of decision.evidence; track item) { <li>{{ item }}</li> }</ul><p><strong>Unlocks:</strong> {{ decision.unlocks }}</p><p><strong>Tradeoff:</strong> {{ decision.tradeoff }}</p><p><strong>Guardrail:</strong> {{ decision.guardrail }}</p></details>
              <p><a class="button secondary" [href]="decision.action.url" target="_blank" rel="noopener">{{ decision.action.label }}</a></p>
              @if (decision.action.command) { <details><summary>Exact founder command</summary><div class="command">{{ decision.action.command }}</div></details> }
            </article>
          }
        }
      </div>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">North star</p><h2>{{ content.strategy.northStar }}</h2></div>
      <div class="panel"><p class="eyebrow">Current bet</p><h2>{{ content.strategy.currentBet }}</h2></div>
    </div></section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Thoughtfulness engine</p><h2>Notice first. Recommend second.</h2></div>
        <p>A gift idea does not enter research because a product is popular. It enters because we can explain the recipient signal, the purchase they postpone, and the reason it will not become clutter.</p>
      </div>
      <div class="principle-grid">
        @for (principle of content.strategy.thoughtfulnessFramework.principles; track principle.id; let index = $index) {
          <article class="principle-card"><span>0{{ index + 1 }}</span><h3>{{ principle.label }}</h3><p>{{ principle.question }}</p></article>
        }
      </div>
    </section>
    <section class="shell compact-section opportunity-desk">
      <div class="section-heading">
        <div><p class="eyebrow">Autonomous opportunity desk</p><h2>Deep weekly research. One proposal at a time.</h2></div>
        <p>The scout looks for the annoyance a recipient tolerates, the upgrade they keep postponing, and pairs that create one coherent story or ritual. It ranks ideas before affiliate economics and cannot approve its own proposal.</p>
      </div>
      <div class="grid two">
        <div class="panel scout-posture">
          <div class="experiment-header"><p class="eyebrow">Current posture</p><span class="status" [class.blocked_on_account]="content.operations.opportunityScouting.posture === 'founder_backlog_full'">{{ displayStatus(content.operations.opportunityScouting.posture) }}</span></div>
          <h2>{{ content.operations.opportunityScouting.openProposals }}/{{ content.operations.opportunityScouting.maxOpenProposals }} founder proposals open.</h2>
          @if (content.operations.opportunityScouting.posture === 'founder_backlog_full') {
            <p>The weekly run stops before calling a model. Resolve one proposal and the next scheduled scout regains capacity automatically.</p>
          } @else {
            <p>{{ content.operations.opportunityScouting.capacityRemaining }} proposal slot{{ content.operations.opportunityScouting.capacityRemaining === 1 ? '' : 's' }} remain. The next scout may draft one thesis for independent review.</p>
          }
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/opportunity-scout.yml" target="_blank" rel="noopener">Inspect opportunity scout</a>
        </div>
        <div class="panel">
          <p class="eyebrow">Authority boundary</p>
          <h2>Propose only. Never self-approve.</h2>
          <p>The research role may append one commission-independent proposal. A different editor must issue a hash-bound receipt. Founder approval, article research, affiliate enrollment, social posting, spend, credentials, Firebase release, and production remain separate gates.</p>
        </div>
      </div>
      <div class="principle-grid scout-thresholds">
        <article class="principle-card"><span>Evidence</span><h3>{{ content.operations.opportunityScouting.policy.minimumSources }}+ public sources</h3><p>Across at least {{ content.operations.opportunityScouting.policy.minimumSourceClasses }} source classes, including {{ content.operations.opportunityScouting.policy.minimumPublicSocialOrCommunitySources }} independent public social or community sources.</p></article>
        <article class="principle-card"><span>Depth</span><h3>{{ content.operations.opportunityScouting.policy.minimumResearchPasses }}+ research passes</h3><p>Research stops only after two consecutive passes add less than {{ content.operations.opportunityScouting.policy.diminishingReturnThreshold * 100 }}% material novelty.</p></article>
        <article class="principle-card"><span>Choice</span><h3>{{ content.operations.opportunityScouting.policy.minimumCandidates }}–{{ content.operations.opportunityScouting.policy.maximumCandidates }} scored theses</h3><p>Every selected idea must name observed friction, a self-purchase gap, fit evidence, editorial whitespace, and rejection conditions.</p></article>
        <article class="principle-card"><span>Quality</span><h3>{{ content.operations.opportunityScouting.policy.minimumThoughtfulnessPotential }}+ thoughtful</h3><p>The selected idea also needs at least {{ content.operations.opportunityScouting.policy.minimumEvidenceConfidence }} evidence confidence and must remain commission-independent.</p></article>
      </div>
      @if (content.operations.opportunityScouting.queue.length > 0) {
        <div class="experiment-grid mission-grid">
          @for (scout of content.operations.opportunityScouting.queue; track scout.scoutId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ scout.expectedProposalId }}</p><span class="status">{{ displayStatus(scout.status) }}</span></div>
              <h3>{{ scout.selectedTitle ?? 'Opportunity research in progress' }}</h3>
              <p><strong>Evidence field:</strong> {{ scout.sources }} sources · {{ scout.sourceClasses }} classes · {{ scout.candidates }} candidates.</p>
              <p><strong>Selected scores:</strong> {{ scout.evidenceConfidence ?? 'Pending' }} evidence · {{ scout.thoughtfulnessPotential ?? 'Pending' }} thoughtfulness.</p>
              <p><strong>Next gate:</strong> {{ scout.nextGate }}</p>
              <details><summary>Exact scout identifiers</summary><div class="command">scout: {{ scout.scoutId }}<br>mission sha256: {{ scout.missionRecordSha256 }}<br>report sha256: {{ scout.reportRecordSha256 ?? 'not drafted' }}<br>review: {{ scout.reviewVerdict ?? 'not reviewed' }}</div></details>
            </article>
          }
        </div>
      }
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Executive idea queue</p><h2>Where the team goes next.</h2></div>
        <div class="actions executive-actions">
          <a class="button" routerLink="/studio/brief">Compose a thoughtful brief</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/issues/new?template=strategy-idea.yml" target="_blank" rel="noopener">Open raw issue form</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml" target="_blank" rel="noopener">Approve a proposal</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/research-agent.yml" target="_blank" rel="noopener">Manual research recovery</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/opportunity-scout.yml" target="_blank" rel="noopener">Run opportunity scout</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/growth-review.yml" target="_blank" rel="noopener">Run growth review</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-approval.yml" target="_blank" rel="noopener">Review affiliate candidate</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-media-approval.yml" target="_blank" rel="noopener">Approve social media</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-content-approval.yml" target="_blank" rel="noopener">Approve social draft</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-pinterest-publish.yml" target="_blank" rel="noopener">Publish approved Pin</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/firebase-production.yml" target="_blank" rel="noopener">Release approved SHA</a>
          <a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/publication-policy-enable.yml" target="_blank" rel="noopener">Review publication mode</a>
        </div>
      </div>
      <div class="idea-list">
        @for (idea of content.strategy.ideas; track idea.id) {
          <article class="idea-card">
            <div class="idea-card-header">
              <div><p class="eyebrow">{{ displayStatus(idea.thesisType) }}</p><h3>{{ idea.title }}</h3><p class="quiet">{{ idea.audience }} · {{ idea.occasion }} · {{ idea.budget }}</p></div>
              <span class="status" [class.blocked_on_account]="stageFor(idea.id) === 'blocked_on_account'" [class.approved_for_research]="stageFor(idea.id) === 'approved_for_research'">{{ displayStatus(stageFor(idea.id)) }}</span>
            </div>
            <p class="idea-insight">{{ idea.insight }}</p>
            <div class="idea-proof-grid">
              <div><strong>Observed friction</strong><p>{{ idea.observedFriction }}</p></div>
              <div><strong>Why they postpone it</strong><p>{{ idea.selfPurchaseReluctance }}</p></div>
              <div><strong>Proof of fit</strong><ul>@for (signal of idea.fitSignals; track signal) { <li>{{ signal }}</li> }</ul></div>
            </div>
            @if (idea.pairing) {
              <div class="pairing-card">
                <div><p class="eyebrow">Pair coherence {{ idea.pairing.coherenceScore }}/100</p><h3>{{ idea.pairing.unifyingIdea }}</h3></div>
                <div class="pair-roles">
                  @for (item of idea.pairing.itemRoles; track item.item) { <div><strong>{{ item.item }}</strong><p>{{ item.role }}</p></div> }
                </div>
                <p><strong>The interaction:</strong> {{ idea.pairing.interactionMoment }}</p>
                <p class="drawback"><strong>Clutter and compatibility risk:</strong> {{ idea.pairing.clutterRisk }}</p>
              </div>
            }
            <details class="idea-details">
              <summary>Open decision brief</summary>
              <p><strong>Next gate:</strong> {{ nextGateFor(idea.id) }}</p>
              <p><strong>Exact founder action:</strong></p>
              <div class="command">{{ founderActionFor(idea) }}</div>
              @if (stageFor(idea.id) === 'proposed') {
                <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/strategy-approval.yml" target="_blank" rel="noopener">Open approval workflow</a></p>
              } @else if (stageFor(idea.id) === 'approved_for_research') {
                <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/research-agent.yml" target="_blank" rel="noopener">Open research recovery</a></p>
              }
              <p><strong>Success:</strong> {{ idea.successMetric }}</p>
              <p><strong>Skip when:</strong></p><ul>@for (risk of idea.avoidIf; track risk) { <li>{{ risk }}</li> }</ul>
              @if (idea.pairing) { <p><strong>Compatibility checks:</strong></p><ul>@for (check of idea.pairing.compatibilityChecks; track check) { <li>{{ check }}</li> }</ul> }
              <p><strong>Research brief:</strong></p><div class="command">{{ idea.researchBrief }}</div>
            </details>
          </article>
        }
      </div>
    </section>
    <section class="shell compact-section editorial-decision-queue">
      <div class="section-heading">
        <div><p class="eyebrow">Editorial decision queue</p><h2>{{ content.operations.editorialReview.counts.pendingBundles }} exact bundle{{ content.operations.editorialReview.counts.pendingBundles === 1 ? '' : 's' }} need a decision.</h2></div>
        <p>Agents can prepare the work. Lucas approves sensitive reader language. A separate editor certifies the exact files. Nothing in this queue can publish itself.</p>
      </div>
      <div class="grid two mission-summary">
        <div class="panel"><p class="eyebrow">Founder boundary</p><h2>{{ content.operations.editorialReview.counts.founderSafetyReviewsRequired }} safety review{{ content.operations.editorialReview.counts.founderSafetyReviewsRequired === 1 ? '' : 's' }} required.</h2><p>{{ content.operations.editorialReview.counts.founderSafetyApprovalsCurrent }} current hash-bound approval{{ content.operations.editorialReview.counts.founderSafetyApprovalsCurrent === 1 ? '' : 's' }} · {{ content.operations.editorialReview.counts.highRiskClaims }} high-risk claims shown below with source bindings.</p><p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/editorial-safety-approval.yml" target="_blank" rel="noopener">Record founder safety decision</a></p></div>
        <div class="panel"><p class="eyebrow">Independent boundary</p><h2>{{ content.operations.editorialReview.counts.independentReviewsRequired }} fresh review{{ content.operations.editorialReview.counts.independentReviewsRequired === 1 ? '' : 's' }} required.</h2><p>The drafting desk cannot approve its own revisions. Every receipt must bind the exact run, article, and social hashes.</p><p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/editorial-independent-review.yml" target="_blank" rel="noopener">Run or monitor independent review</a></p></div>
      </div>
      @if (content.operations.editorialReview.queue.length > 0) {
        <div class="experiment-grid editorial-review-grid">
          @for (review of content.operations.editorialReview.queue; track review.runId) {
            <article class="experiment-card editorial-review-card">
              <div class="experiment-header"><p class="eyebrow">{{ review.ideaId }} · {{ review.articleSlug }}</p><span class="status blocked_on_account">{{ displayStatus(review.status) }}</span></div>
              <h3>{{ review.founderSafetyReviewStatus === 'approved_current' ? 'Founder language approved; independent QA still required' : review.founderSafetyReviewStatus === 'rejected_current' ? 'Founder rejected this exact language' : review.founderSafetyReviewStatus === 'stale' ? 'Founder decision is stale after a source change' : review.founderSafetyReviewRequired ? 'Founder language review, then independent QA' : 'Independent QA required' }}</h3>
              <p><strong>Founder safety status:</strong> {{ displayStatus(review.founderSafetyReviewStatus) }}@if (review.safetyApproval) { · revision {{ review.safetyApproval.revision }} · <a [href]="'https://github.com/lucasdmoyer/tipsforyourgifts/blob/' + 'master/web/' + review.safetyApproval.path" target="_blank" rel="noopener">open exact decision</a> }</p>
              @if (review.founderSafetyReviewStatus === 'approved_current') { <p><a class="button secondary" href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/editorial-independent-review.yml" target="_blank" rel="noopener">Run independent evidence review</a></p> }
              <p><strong>Blocking decisions:</strong></p><ul>@for (blocker of review.blockers; track blocker) { <li>{{ blocker }}</li> }</ul>
              @if (review.highRiskClaims.length > 0) {
                <details open><summary>Exact high-risk claims</summary>
                  @for (claim of review.highRiskClaims; track claim.id) {
                    <div class="editorial-claim"><p><strong>{{ claim.id }}</strong></p><p>{{ claim.text }}</p><p class="quiet">Sources: {{ claim.sourceIds.join(', ') }}</p></div>
                  }
                </details>
              }
              @if (review.founderDecisionPacket) {
                <details class="founder-decision-packet"><summary>Copy exact founder decision</summary>
                  <p><strong>Approve this exact language:</strong></p><div class="command">{{ review.founderDecisionPacket.approveCommand }}</div>
                  <p><strong>Reject this exact language:</strong></p><div class="command">{{ review.founderDecisionPacket.rejectCommand }}</div>
                  <p class="quiet">{{ review.founderDecisionPacket.authorityBoundary }}</p>
                  <p><a class="button secondary" [href]="review.founderDecisionPacket.workflowUrl" target="_blank" rel="noopener">Open founder decision workflow</a></p>
                </details>
              }
              <p><strong>Next gate:</strong> {{ review.nextGate }}</p>
              <details><summary>Warnings and exact file identity</summary><ul>@for (warning of review.warnings; track warning) { <li>{{ warning }}</li> }</ul><div class="command">run: {{ review.sourcePaths.run }}<br>run sha256: {{ review.sourceSha256.run }}<br>article: {{ review.sourcePaths.article }}<br>article sha256: {{ review.sourceSha256.article }}<br>social: {{ review.sourcePaths.social ?? 'none' }}<br>social sha256: {{ review.sourceSha256.social ?? 'none' }}</div></details>
            </article>
          }
        </div>
      } @else {
        <div class="panel"><p class="eyebrow">Queue clear</p><h2>No draft bundle is waiting on founder or independent review.</h2></div>
      }
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Monetization and distribution</p><h2>Proposals move. Authority does not leak.</h2></div>
        <p>Affiliate candidates and social assets can be researched and queued automatically. Account enrollment, terms, tracking identities, asset rights, cadence, and public posting remain separately recorded founder decisions.</p>
      </div>
      <div class="grid two">
        <div class="panel">
          <p class="eyebrow">Affiliate decision queue</p>
          <h2>{{ content.operations.affiliate.proposedPrograms }} programs proposed. {{ content.operations.affiliate.activeOverlays }} paid links active.</h2>
          <p><strong>{{ content.operations.affiliate.publicationReadyProductLinksCataloged }}</strong> publication-ready product links cataloged · <strong>{{ content.operations.affiliate.publicationReadyPaidLinksVerified }}</strong> verified paid links · <strong>{{ content.operations.affiliate.publicationReadyOrdinaryLinks }}</strong> ordinary links.</p>
          <p><strong>{{ content.operations.affiliate.productsAssignedToPartnerResearch }}/{{ content.operations.affiliate.publicationReadyProductLinksCataloged }}</strong> assigned to partner research · <strong>{{ content.operations.affiliate.productsWithoutPartnerResearch }}</strong> research gaps. Assignment does not claim exact retailer availability or paid-link eligibility.</p>
          <p><strong>{{ content.operations.affiliate.publicApplicationPacketsReady }}</strong> public application packets ready · <strong>{{ content.operations.affiliate.externalEnrollmentAllowedByRegistry }}</strong> eligible for external enrollment planning · <strong>{{ content.operations.affiliate.awaitingFounderProgramApproval }}</strong> awaiting program approval · <strong>{{ content.operations.affiliate.externallyEnrolledPrograms }}</strong> externally verified accounts. Every portal submission still requires action-time approval.</p>
          <p><strong>{{ content.operations.affiliate.linkCandidates }}</strong> exact candidates · <strong>{{ content.operations.affiliate.linkReviewsPassed }}</strong> clean independent reviews · <strong>{{ content.operations.affiliate.linkApprovals }}</strong> founder approvals.</p>
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-approval.yml" target="_blank" rel="noopener">Program onboarding approval</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-program-activate.yml" target="_blank" rel="noopener">Program activation</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-candidate.yml" target="_blank" rel="noopener">Exact-link candidate</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-review.yml" target="_blank" rel="noopener">Independent link review</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/affiliate-link-approval.yml" target="_blank" rel="noopener">Founder link approval</a></p>
          <details><summary>Exact approved-overlay digest</summary><div class="command">{{ content.operations.affiliate.approvedOverlaySetSha256 }}</div></details>
          @for (proposal of content.operations.affiliate.activationProposals; track proposal.id) {
            <article class="connector-row affiliate-decision-packet">
              <div>
                <p class="eyebrow">Bookshop decision packet</p>
                @if (proposal.activationState === 'activation_recorded' && content.operations.affiliate.activeOverlays > 0) {
                  <strong>Narrow program active. {{ content.operations.affiliate.activeOverlays }} independently reviewed paid {{ content.operations.affiliate.activeOverlays === 1 ? 'link is' : 'links are' }} live.</strong>
                } @else {
                  <strong>{{ proposal.activationState === 'activation_recorded' ? 'Narrow program activation recorded. No paid links yet.' : 'Verified account. One observed book link. Still disabled.' }}</strong>
                }
              </div>
              <span class="status" [class.blocked_on_account]="proposal.activationState !== 'activation_recorded'">{{ displayStatus(proposal.activationState) }}</span>
              <p class="connector-gate"><strong>Account:</strong> {{ proposal.evidence.publicTrackingIdentity }} · weekly reports enabled · <a [href]="proposal.evidence.publicStorefrontUrl" target="_blank" rel="noopener">public storefront</a></p>
              <p class="connector-gate"><strong>Narrow pilot:</strong> {{ proposal.evidence.productId }} · ISBN {{ proposal.evidence.productIsbn }} · {{ proposal.evidence.purchaseActionLabel }} observed through an authenticated browser. {{ content.operations.affiliate.activeOverlays > 0 ? 'Independent product-level review and founder approval are recorded for the exact active overlay.' : 'Independent product-level affiliate review is still required.' }}</p>
              <p class="connector-gate">The public affiliate path resolved to the intended edition with <code>affiliate={{ proposal.evidence.publicTrackingIdentity }}</code>. Automated verification received HTTP {{ proposal.evidence.automatedFetchStatus }}, so the packet records the browser observation and does not pretend the automated fetch passed.</p>
              <p class="connector-gate"><strong>Terms reviewed:</strong> {{ proposal.evidence.termsLastUpdated }} · <a [href]="proposal.evidence.termsSourceUrl" target="_blank" rel="noopener">source URL</a> · <a [href]="proposal.evidence.termsResolvedUrl" target="_blank" rel="noopener">resolved terms document</a> · <a [href]="proposal.evidence.linkGuideUrl" target="_blank" rel="noopener">link guide</a> · <a [href]="proposal.evidence.disclosureGuideUrl" target="_blank" rel="noopener">disclosure guide</a></p>
              <p class="connector-gate"><strong>Proposed boundary:</strong> {{ proposal.activation.registeredSite }} · {{ proposal.activation.allowedDomains.join(', ') }} · aggregate reporting export {{ proposal.activation.reportingExportApproved ? 'approved' : 'not approved' }} · price feed {{ proposal.activation.priceFeedAuthorized ? 'approved' : 'not approved' }}.</p>
              <p class="connector-gate"><strong>Next gate:</strong> {{ proposal.activationState === 'activation_recorded' ? (content.operations.affiliate.activeOverlays > 0 ? 'Keep the narrow Sapiens link verified. Add another paid link only after a fresh exact-destination review and separate founder approval.' : 'Create one exact product-level candidate, complete an independent destination review, and obtain a separate founder approval before any paid link can enter a Firebase preview.') : 'Lucas explicitly accepts the reviewed terms and this exact activation boundary. That separate approval may enable the program; it does not create a product-level candidate or authorize production.' }}</p>
              <details class="connector-gate"><summary>Exact observed URL and approval boundary</summary><div class="command">paid: {{ proposal.evidence.observedPaidUrl }}<br>resolved: {{ proposal.evidence.observedResolvedUrl }}<br>observation receipt: {{ proposal.evidence.observationReceiptPath }}<br>observation receipt sha256: {{ proposal.evidence.observationReceiptSha256 }}<br>approval boundary sha256: {{ proposal.approvalBoundarySha256 }}</div></details>
            </article>
          }
          <details><summary>Reusable public application profile</summary><p>{{ content.operations.affiliate.siteApplicationDescription }}</p><p class="quiet">{{ content.operations.affiliate.sensitiveDataPolicy }}</p></details>
          <p><a [href]="content.operations.affiliate.productCoverageArtifactPath" target="_blank" rel="noopener">Open the product-level affiliate research ledger</a> · <a [href]="content.operations.affiliate.enrollmentReadinessArtifactPath" target="_blank" rel="noopener">Open enrollment-readiness packets</a></p>
          <div class="connector-list">
            @for (program of content.operations.affiliate.programs; track program.id) {
              <div class="connector-row">
                <div><strong>{{ program.name }}</strong><p>Priority {{ program.priority }} · {{ displayStatus(program.coverageRole) }} · {{ program.productResearchCandidates }} product research candidates · {{ program.verifiedPaidLinks }} verified paid</p><p>{{ program.productSelectionMode === 'explicit_products' ? 'explicit product research scope' : program.productSelectionMode === 'all_publication_ready_products' ? 'every present and future publication-ready product is queued automatically' : 'all products in the configured articles are queued' }} · {{ program.productSelectionMode === 'all_publication_ready_products' ? 'no manual article list' : program.eligibleArticleSlugs.length + ' configured articles' }} · revision {{ program.revision }} · review expires {{ program.sourceReviewExpiresAt }}</p><p>Enrollment: {{ displayStatus(program.enrollmentStage) }} · public packet {{ program.publicApplicationPacketReady ? 'ready' : 'incomplete' }} · portal submission requires action-time approval</p></div>
                <span class="status" [class.blocked_on_account]="program.status === 'proposed'">{{ displayStatus(program.status) }}</span>
                @if (program.externalAccountEstablished) { <p class="connector-gate"><strong>Verified public account:</strong> {{ program.publicTrackingIdentity }} · weekly reports {{ program.weeklyReportsEnabled ? 'enabled' : 'not observed' }} · @if (program.publicStorefrontUrl) { <a [href]="program.publicStorefrontUrl" target="_blank" rel="noopener">open storefront</a> }</p> }
                <p class="connector-gate">{{ program.editorialFit }}</p>
                <details class="connector-gate"><summary>Open enrollment brief</summary><p>{{ program.applicationPositioning }}</p><p><strong>Lucas enters privately in the partner portal:</strong></p><ul>@for (input of program.userOnlyInputs; track input) { <li>{{ displayStatus(input) }}</li> }</ul><p><strong>Stop conditions:</strong></p><ul>@for (condition of program.stopConditions; track condition) { <li>{{ condition }}</li> }</ul></details>
                <p class="connector-gate"><strong>Next gate:</strong> {{ program.nextGate }}</p>
                <p class="connector-gate"><a [href]="program.programHomepageUrl" target="_blank" rel="noopener">Official program page</a> · <a [href]="program.termsUrl" target="_blank" rel="noopener">Terms or policy source</a></p>
              </div>
            }
          </div>
          @if (content.operations.affiliate.linkQueue.length > 0) {
            <div class="connector-list">
              @for (candidate of content.operations.affiliate.linkQueue; track candidate.candidateId) {
                <div class="connector-row">
                  <div><strong>{{ candidate.productId }}</strong><p>{{ candidate.articleSlug }} · {{ candidate.destinationHostname }} · candidate v{{ candidate.candidateRevision }}</p><p class="quiet">Source: {{ displayStatus(candidate.originSource) }}{{ candidate.originReferenceId ? ' · ' + candidate.originReferenceId : '' }}</p></div>
                  <span class="status" [class.blocked_on_account]="candidate.stage === 'review_failed'">{{ displayStatus(candidate.stage) }}</span>
                  <p class="connector-gate"><strong>Next gate:</strong> {{ candidate.nextGate }}</p>
                  <details><summary>Exact candidate and source digests</summary><div class="command">candidate: {{ candidate.candidateSha256 }}<br>source artifact: {{ candidate.originSourceArtifactPath ?? 'founder supplied in the action-time workflow' }}<br>source sha256: {{ candidate.originSourceSha256 ?? 'not applicable' }}</div></details>
                </div>
              }
            </div>
          }
        </div>
        <div class="panel">
          <p class="eyebrow">Official channel registry</p>
          <h2>{{ content.operations.social.channelsActive }}/{{ content.operations.social.channelsTotal }} channels active.</h2>
          <p><strong>{{ content.operations.social.creativeCandidates }}</strong> original creative candidates · <strong>{{ content.operations.social.mediaAssetsApproved }}</strong> approved media · <strong>{{ content.operations.social.approvalReceipts }}</strong> content receipts · <strong>{{ content.operations.social.publishReady }}</strong> ready for official API.</p>
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-configure.yml" target="_blank" rel="noopener">Configure official channel</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/social-channel-activate.yml" target="_blank" rel="noopener">Activate publishing boundary</a></p>
          <details><summary>Exact channel-registry digest</summary><div class="command">{{ content.operations.social.configSha256 }}</div></details>
          <div class="connector-list">
            @for (channel of content.operations.social.channels; track channel.id) {
              <div class="connector-row">
                <div><strong>{{ displayStatus(channel.id) }}</strong><p>Priority {{ channel.priority }} · {{ channel.maxPostsPerWeek }} approved posts/week</p></div>
                <span class="status" [class.blocked_on_account]="channel.status === 'not_connected'">{{ displayStatus(channel.status) }}</span>
                <p class="connector-gate">{{ channel.nextGate }}</p>
              </div>
            }
          </div>
        </div>
      </div>
      <details class="queue-details">
        <summary>Open the {{ content.operations.social.queue.length }}-post approval queue</summary>
        <div class="experiment-grid">
          @for (post of content.operations.social.queue; track post.postId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ displayStatus(post.platform) }} · {{ displayStatus(post.format) }}</p><span class="status" [class.blocked_on_account]="post.publishReadiness.startsWith('blocked')">{{ displayStatus(post.status) }}</span></div>
              <h3>{{ post.headline }}</h3>
              @if (post.creativeCandidateAssetPath) {
                <figure class="creative-preview">
                  <img [src]="post.creativeCandidateAssetPath" [alt]="post.creativeCandidateAltText ?? post.headline" loading="lazy" width="1024" height="1536">
                  <figcaption>Original creative candidate · generated, locally verified, not rights-approved or published.</figcaption>
                </figure>
              }
              <p>{{ post.angle }}</p>
              <p><strong>Evidence bindings:</strong> {{ post.claimCount }} claims · {{ post.productCount }} products · {{ post.pairCount }} pairs</p>
              <p><strong>Publish readiness:</strong> {{ displayStatus(post.publishReadiness) }}</p>
              <p><strong>Next gate:</strong> {{ post.nextGate }}</p>
              @if (post.externalPostUrl) { <p><a [href]="post.externalPostUrl" target="_blank" rel="noopener">Open verified external post</a></p> }
              <details><summary>Exact approval identifiers</summary><div class="command">post: {{ post.postId }}<br>pack: {{ post.packId }}<br>pack sha256: {{ post.packSha256 }}<br>creative candidate: {{ post.creativeCandidateId ?? 'not generated' }}<br>candidate record sha256: {{ post.creativeCandidateRecordSha256 ?? 'not generated' }}<br>creative bytes sha256: {{ post.creativeCandidateContentSha256 ?? 'not generated' }}<br>media: {{ post.mediaAssetId ?? 'not approved' }}<br>media record sha256: {{ post.mediaAssetRecordSha256 ?? 'not approved' }}<br>content approval: {{ post.approvalId ?? 'not approved' }}<br>publication receipt: {{ post.publicationReceiptId ?? 'not published' }}<br>external post ID: {{ post.externalPostId ?? 'not published' }}</div></details>
            </article>
          }
        </div>
      </details>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">Distribution queue</p><h2>Traffic assets are prepared, not posted.</h2><p><strong>{{ content.operations.socialDrafts }}</strong> drafts lack content approval. <strong>{{ content.operations.social.creativeCandidates }}</strong> have an original locally verified visual candidate, <strong>{{ content.operations.social.mediaAssetsApproved }}</strong> have founder-approved byte-verified media, <strong>{{ content.operations.socialApproved }}</strong> are content-approved and unpublished, <strong>{{ content.operations.social.publishReady }}</strong> are ready for the official API, and <strong>{{ content.operations.socialPublished }}</strong> have verified external post IDs.</p></div>
      <div class="panel"><p class="eyebrow">Automation posture</p><h2>Ideas flow in. Authority stays separated.</h2><p>The weekly opportunity desk can propose one deeply researched thesis when the founder queue has capacity. A founder-authored strategy issue can also become a proposed brief. A separate deterministic workflow records approval; after that approval pull request merges, the exact strategy transition is revalidated and the hash-bound article research mission is queued automatically. Git review, Firebase preview, affiliate enrollment, and official social APIs remain separate gates.</p><p><strong>Publication mode:</strong> {{ displayStatus(content.operations.publication.mode) }} · policy snapshot {{ content.operations.publication.verifiedSuccessfulReleaseCount }}/{{ content.operations.publication.minimumSuccessfulFounderReviewedReleases }}. The enable workflow recounts unique successful GitHub production deployments before proposing automatic mode.</p><p><strong>Current release candidate:</strong> {{ content.operations.publication.currentCandidate.manifestId }} · {{ content.operations.publication.currentCandidate.articles }} articles · {{ content.operations.publication.currentCandidate.independentReviews }} independent receipts · {{ content.operations.publication.currentCandidate.founderSafetyApprovals }} founder safety receipts · {{ content.operations.publication.currentCandidate.socialLaunchPacks }} launch packs · {{ content.operations.publication.currentCandidate.socialDrafts }} social drafts · {{ content.operations.publication.currentCandidate.affiliateLinks }} affiliate links. This manifest describes prepared bytes; it is not proof of a live deployment.</p><details><summary>Exact candidate content digest</summary><div class="command">{{ content.operations.publication.currentCandidate.contentSetSha256 }}</div></details>@if (content.operations.publication.currentLive.status === 'verified_managed_content_release') { <p><strong>Git-recorded live content:</strong> {{ content.operations.publication.currentLive.manifestId }} · {{ content.operations.publication.currentLive.articles }} articles · candidate match {{ content.operations.publication.currentLive.matchesCurrentCandidate ? 'yes' : 'no' }}.</p><p><a [href]="content.operations.publication.currentLive.workflowRunUrl" target="_blank" rel="noopener">Open verified release workflow</a></p><details><summary>Exact durable release evidence</summary><div class="command">receipt: {{ content.operations.publication.currentLive.receiptId }}<br>receipt sha256: {{ content.operations.publication.currentLive.receiptSha256 }}<br>release sha: {{ content.operations.publication.currentLive.releaseSha }}<br>content set sha256: {{ content.operations.publication.currentLive.contentSetSha256 }}</div></details> } @else { <p><strong>Git-recorded live content:</strong> no verified managed release is recorded. This does not claim Firebase is empty; legacy or out-of-band state remains unknown until a managed receipt is synchronized.</p> }<p><strong>Release proof:</strong> the founder workflow builds an exact-SHA candidate, pauses with its preview URL for production approval, then promotes the same static artifact and records the deployed manifest, rollback target, live smoke, and a machine-validated receipt retained for {{ content.operations.publication.receiptRetentionDays }} days.</p></div>
    </div></section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Research mission control</p><h2>One founder decision. Four accountable roles.</h2></div>
        <p>The trusted envelope binds the approved idea, base commit, thresholds, team authority, expected deliverables, and publication policy before Codex receives a key. Completion binds the exact run, article, social pack, and independent QA receipt by SHA-256.</p>
      </div>
      <div class="principle-grid">
        <article class="principle-card"><span>01</span><h3>Research editorial team</h3><p>Deep public research, claim ledger, thoughtful finalists, article draft, and social launch pack. Draft authority only.</p></article>
        <article class="principle-card"><span>02</span><h3>Independent evidence editor</h3><p>Challenges every claim, compatibility assumption, drawback, affiliate posture, and pair. Receipt authority only.</p></article>
        <article class="principle-card"><span>03</span><h3>Release operator</h3><p>Re-runs deterministic gates, opens the exact mission branch and pull request, and prepares Firebase preview evidence.</p></article>
        <article class="principle-card"><span>04</span><h3>Growth analyst</h3><p>Waits for complete aggregate reporting windows, then measures traffic, engagement, merchant clicks, conversions, and revenue.</p></article>
      </div>
      <div class="grid two mission-summary">
        <div class="panel"><p class="eyebrow">Mission receipts</p><h2>{{ content.operations.researchMissions.completed }} completed · {{ content.operations.researchMissions.active }} active</h2><p>{{ content.operations.researchMissions.founderReviewRequired }} await founder release review; {{ content.operations.researchMissions.automaticMergeEligible }} qualify for the separately approved automatic-merge policy.</p></div>
        <div class="panel"><p class="eyebrow">Completion boundary</p><h2>Research done is not production live.</h2><p>A completed mission hands one validated article to release preparation. Production is proven only by the exact deployment receipt and post-release checks.</p></div>
      </div>
      @if (content.operations.researchMissions.queue.length > 0) {
        <div class="experiment-grid mission-grid">
          @for (mission of content.operations.researchMissions.queue; track mission.missionId) {
            <article class="experiment-card">
              <div class="experiment-header"><p class="eyebrow">{{ mission.ideaId }} · revision {{ mission.ideaRevision }}</p><span class="status">{{ displayStatus(mission.status) }}</span></div>
              <h3>{{ mission.ideaTitle }}</h3>
              <p><strong>Active handoff:</strong> {{ displayStatus(mission.activeStage) }}</p>
              <p><strong>Publication readiness:</strong> {{ displayStatus(mission.publicationReadiness) }}</p>
              <p><strong>Next gate:</strong> {{ mission.nextGate }}</p>
              <details><summary>Exact mission identifiers</summary><div class="command">mission: {{ mission.missionId }}<br>record sha256: {{ mission.recordSha256 }}<br>idea sha256: {{ mission.ideaSha256 }}<br>workflow run: {{ mission.workflowRunId }}<br>research run: {{ mission.runId ?? 'not completed' }}<br>article: {{ mission.articleSlug ?? 'not completed' }}</div></details>
            </article>
          }
        </div>
      } @else {
        <div class="panel empty-mission"><p class="eyebrow">Ready for first workflow receipt</p><h2>No automated mission has completed yet.</h2><p>The four existing validated guides predate this mission ledger. The next founder-started run will create the first durable envelope and completion receipt.</p></div>
      }
    </section>
    <section class="shell compact-section">
      <div class="section-heading">
        <div><p class="eyebrow">Profitability loop</p><h2>Measure first. Scale what earns attention.</h2></div>
        <p>Only aggregate, consent-aware exports enter this view. Missing traffic, conversion, and revenue values stay unknown—not zero—and no experiment can run without a founder-approved baseline.</p>
      </div>
      <div class="grid two">
        <div class="panel">
          <p class="eyebrow">Measurement connectors</p>
          <div class="connector-list">
            @for (connector of content.growth.connectors; track connector.id) {
              <div class="connector-row">
                <div><strong>{{ connector.name }}</strong><p>{{ connector.metrics.map(metricLabel).join(' · ') }}</p></div>
                <span class="status" [class.blocked_on_account]="connector.status === 'not_connected'">{{ displayStatus(connector.status) }}</span>
                <p class="connector-gate">{{ connector.nextGate }}</p>
                @if (connector.configurationEvidenceUrl) { <p><a [href]="connector.configurationEvidenceUrl" target="_blank" rel="noopener">Review configuration evidence</a></p> }
              </div>
            }
          </div>
        </div>
        <div class="panel measurement-panel">
          <p class="eyebrow">Data quality</p>
          <h2>{{ displayStatus(content.operations.growth.measurementStatus) }}</h2>
          <dl class="measurement-list">
            <div><dt>Aggregate snapshots</dt><dd>{{ content.operations.growth.snapshotCount }}</dd></div>
            <div><dt>Active connectors</dt><dd>{{ content.operations.growth.connectorsActive }}/{{ content.operations.growth.connectorsTotal }}</dd></div>
            <div><dt>Latest complete period</dt><dd>{{ content.operations.growth.latestPeriodEnd ?? 'Unknown' }}</dd></div>
            <div><dt>Personal data stored</dt><dd>No</dd></div>
          </dl>
          <p><strong>Privacy review:</strong> {{ displayStatus(content.growth.measurementPolicy.privacyReview.status) }} · client collection {{ content.growth.measurementPolicy.privacyReview.clientCollectionEnabled ? 'enabled' : 'disabled' }}.</p>
          <p><strong>Baseline:</strong> {{ displayStatus(content.growth.measurementPolicy.privacyReview.baselineStatus) }}. Unknown traffic is not reported as zero.</p>
          <details><summary>Founder-approved measurement boundary</summary><p>{{ content.growth.measurementPolicy.privacyReview.decisionSummary }}</p><div class="command">decision: {{ content.growth.measurementPolicy.privacyReview.decisionId }}<br>approved: {{ content.growth.measurementPolicy.privacyReview.approvedAt }}<br>events: {{ content.growth.measurementPolicy.privacyReview.approvedEventNames.join(', ') }}</div></details>
          <p><strong>Search Console:</strong> {{ displayStatus(content.operations.growth.searchConsole.status) }} · automated aggregate collection {{ content.operations.growth.searchConsole.automatedCollectionEnabled ? 'enabled' : 'disabled' }}.</p>
          @if (content.operations.growth.searchConsole.propertyReference) { <p><strong>Exact property:</strong> {{ content.operations.growth.searchConsole.propertyReference }}</p> }
          <p><a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-configure.yml" target="_blank" rel="noopener">Configure Search Console</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-activate.yml" target="_blank" rel="noopener">Activate collector</a> · <a href="https://github.com/lucasdmoyer/tipsforyourgifts/actions/workflows/search-console-collect.yml" target="_blank" rel="noopener">Collect aggregate snapshot</a></p>
          <details><summary>Exact growth registry digest</summary><div class="command">{{ content.operations.growth.configSha256 }}</div></details>
          <p class="quiet">Import only complete aggregate windows of at least {{ content.growth.measurementPolicy.minimumReportingWindowDays }} days. The gate rejects identifiers, raw queries, negative metrics, unknown articles, and unapproved affiliate exports.</p>
        </div>
      </div>
      @if (content.operations.growth.commercialScorecard; as scorecard) {
        <div id="commercial-scorecard" class="panel commercial-scorecard">
          <div class="experiment-header">
            <div><p class="eyebrow">Commercial scorecard</p><h2>{{ displayStatus(scorecard.evidenceStage) }}</h2></div>
            <span class="status" [class.blocked_on_account]="scorecard.status === 'awaiting_observed_export'">{{ displayStatus(scorecard.status) }}</span>
          </div>
          @if (scorecard.periodStart && scorecard.periodEnd) {
            <p>Latest comparable aggregate window: <strong>{{ scorecard.periodStart }} through {{ scorecard.periodEnd }}</strong> · {{ scorecard.reportingWindowDays }} days · {{ scorecard.articleCount }} article{{ scorecard.articleCount === 1 ? '' : 's' }}.</p>
          } @else {
            <p>No complete aggregate reporting window has been imported. Every commercial value below remains unknown—not zero.</p>
          }
          <dl class="measurement-list">
            <div><dt>Organic click-through</dt><dd>{{ formatPercent(scorecard.rates.organicClickThrough) }}</dd></div>
            <div><dt>Merchant click-through</dt><dd>{{ formatPercent(scorecard.rates.merchantClickThrough) }}</dd></div>
            <div><dt>Affiliate conversion</dt><dd>{{ formatPercent(scorecard.rates.affiliateConversion) }}</dd></div>
            <div><dt>Earnings per outbound click</dt><dd>{{ formatMoney(scorecard.rates.earningsPerOutboundClickUsd) }}</dd></div>
            <div><dt>Observed affiliate revenue</dt><dd>{{ formatMoney(scorecard.totals.revenueUsd) }}</dd></div>
            <div><dt>Observed conversions</dt><dd>{{ formatCount(scorecard.totals.affiliateConversions) }}</dd></div>
            <div><dt>Social owned-site click-through</dt><dd>{{ formatPercent(scorecard.rates.socialOwnedClickThrough) }}</dd></div>
            <div><dt>Known metric families</dt><dd>{{ scorecard.knownMetrics.length }}/{{ scorecard.knownMetrics.length + scorecard.missingMetrics.length }}</dd></div>
          </dl>
          <p><strong>Next evidence gate:</strong> {{ scorecard.nextGate }}</p>
          <p class="quiet"><strong>Profit boundary:</strong> Revenue is not profit. Operating costs are not part of this registry, so this scorecard cannot label the publication profitable even after revenue is observed.</p>
          @if (scorecard.leaders.revenueUsd; as leader) {
            <p><strong>Observed revenue leader:</strong> {{ displaySlug(leader.slug) }} · {{ formatMoney(leader.value) }}</p>
          } @else if (scorecard.leaders.outboundMerchantClicks; as leader) {
            <p><strong>Observed merchant-intent leader:</strong> {{ displaySlug(leader.slug) }} · {{ formatCount(leader.value) }} outbound clicks</p>
          } @else if (scorecard.leaders.organicClicks; as leader) {
            <p><strong>Observed organic-discovery leader:</strong> {{ displaySlug(leader.slug) }} · {{ formatCount(leader.value) }} clicks</p>
          }
          <details><summary>Exact scorecard evidence</summary><div class="command">snapshots: {{ scorecard.snapshotIds.length > 0 ? scorecard.snapshotIds.join(', ') : 'none' }}<br>connectors: {{ scorecard.sourceConnectorIds.length > 0 ? scorecard.sourceConnectorIds.join(', ') : 'none' }}<br>profitability conclusion: {{ scorecard.profitabilityConclusion }}</div></details>
        </div>
      }
      <div class="experiment-grid">
        @for (experiment of content.growth.experiments; track experiment.id) {
          <article class="experiment-card">
            <div class="experiment-header"><p class="eyebrow">{{ displayStatus(experiment.channel) }}</p><span class="status">{{ displayStatus(experiment.founderDisposition) }}</span></div>
            <h3>{{ experiment.title }}</h3>
            <p>{{ experiment.hypothesis }}</p>
            <p><strong>Primary signal:</strong> {{ metricLabel(experiment.primaryMetric) }}</p>
            <p><strong>Decision rule:</strong> {{ experiment.decisionRule }}</p>
            <details><summary>Stop conditions</summary><ul>@for (condition of experiment.stopConditions; track condition) { <li>{{ condition }}</li> }</ul></details>
          </article>
        }
      </div>
    </section>
    <section class="shell compact-section"><div class="grid two">
      <div class="panel"><p class="eyebrow">Operating alerts</p><h2>Needs founder attention.</h2><ul class="alert-list">@for (alert of content.operations.alerts; track alert) { <li>{{ alert }}</li> }</ul></div>
      <div class="panel">
        <p class="eyebrow">Start the next run</p>
        @if (nextResearchIdea) {
          <h2>{{ nextResearchIdea.title }}</h2>
          <p>This founder-approved thesis is awaiting its hash-bound mission receipt. Confirm the approval handoff dispatched it; use the command only if the automatic dispatch failed.</p>
          <div class="command">Recovery only: gh workflow run research-agent.yml -f idea_id={{ nextResearchIdea.id }}</div>
        } @else {
          @if (nextFounderDecision) {
            <h2>{{ nextFounderDecision.title }}</h2>
            <p><strong>{{ proposedIdeas.length }}</strong> thoughtful {{ proposedIdeas.length === 1 ? 'thesis awaits' : 'theses await' }} your decision. This is the highest-priority proposal; merging its approval pull request automatically queues research and authorizes nothing beyond that mission.</p>
            <div class="command">{{ founderActionFor(nextFounderDecision) }}</div>
          } @else {
            <h2>No approved idea is waiting.</h2>
            <p>Suggest or revise a strategy thesis before starting another research run.</p>
          }
        }
      </div>
    </div></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioPage {
  readonly content = inject(STUDIO_DATA);
  private readonly ideaStages = new Map(this.content.operations.ideaStages.map((idea) => [idea.ideaId, idea]));
  readonly nextResearchIdea = this.content.strategy.ideas.find((idea) => this.ideaStages.get(idea.id)?.stage === 'approved_for_research');
  readonly proposedIdeas = this.content.strategy.ideas
    .filter((idea) => idea.founderDisposition === 'proposed')
    .sort((left, right) => ({ high: 0, medium: 1, low: 2 }[left.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[right.priority] ?? 3) || (right.pairing?.coherenceScore ?? 0) - (left.pairing?.coherenceScore ?? 0) || left.id.localeCompare(right.id));
  readonly nextFounderDecision = this.proposedIdeas[0];
  readonly kpis = [
    { label: 'Founder decisions', value: this.content.operations.founderAgenda.decisions.length },
    { label: 'Research runs', value: this.content.operations.researchRuns },
    { label: 'Validated', value: this.content.operations.validatedRuns },
    { label: 'Publication ready', value: this.content.operations.publicationReadyPosts },
    { label: 'Social drafts', value: this.content.operations.socialDrafts },
    { label: 'Affiliate candidates', value: this.content.operations.affiliateProgramsProposed },
    { label: 'Affiliate verified', value: this.content.operations.affiliateProgramsExternallyVerified },
    { label: 'Affiliate enabled', value: this.content.operations.affiliateProgramsEnabled },
    { label: 'Strategy proposals', value: this.content.operations.proposedIdeas },
    { label: 'Scout posture', value: this.displayStatus(this.content.operations.opportunityScouting.posture) },
    { label: 'Scout reports', value: this.content.operations.opportunityScouting.validatedReports },
    { label: 'Auto release', value: this.content.operations.publication.automaticPromotionEnabled ? 'ON' : 'OFF' },
    { label: 'Ready to research', value: this.content.operations.pipeline['ready'] ?? 0 },
    { label: 'Missions active', value: this.content.operations.researchMissions.active },
    { label: 'Missions completed', value: this.content.operations.researchMissions.completed },
    { label: 'Growth snapshots', value: this.content.operations.growth.snapshotCount },
    { label: 'Social channels active', value: this.content.operations.social.channelsActive },
    { label: 'Creative candidates', value: this.content.operations.social.creativeCandidates },
    { label: 'Social publish ready', value: this.content.operations.social.publishReady },
    { label: 'Experiments proposed', value: this.content.operations.growth.proposedExperiments }
  ];
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Executive studio', description: 'Founder strategy, editorial pipeline, operating alerts, and next actions for Tips for Your Gifts.', path: '/studio', noindex: true });
  }
  displayStatus(status: string) { return status.replaceAll('_', ' '); }
  displaySlug(slug: string) { return slug.replaceAll('-', ' '); }
  formatPercent(value: number | null) { return value === null ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value); }
  formatMoney(value: number | null) { return value === null ? 'Unknown' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value); }
  formatCount(value: number | null) { return value === null ? 'Unknown' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value); }
  readonly metricLabel = (metric: string) => metric.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  stageFor(ideaId: string) { return this.ideaStages.get(ideaId)?.stage ?? 'untracked'; }
  nextGateFor(ideaId: string) { return this.ideaStages.get(ideaId)?.nextGate ?? 'Connect this idea to the strategy pipeline.'; }
  founderActionFor(idea: StrategyIdea) {
    const stage = this.stageFor(idea.id);
    if (stage === 'proposed') return `gh workflow run strategy-approval.yml -f idea_id=${idea.id} -f expected_revision=${idea.revision}`;
    if (stage === 'approved_for_research') return `Confirm the approval handoff queued ${idea.id}. Recovery only: gh workflow run research-agent.yml -f idea_id=${idea.id}`;
    if (stage === 'research_mission_active') return `Monitor the hash-bound mission receipt for ${idea.id}; do not start a duplicate run.`;
    if (stage === 'publication_ready') return `Review the exact-SHA pull request and Firebase preview for ${idea.id} before production release.`;
    if (stage === 'blocked_on_account') return `Resolve the founder-approved account, rights, cadence, and official API gates for ${idea.id}.`;
    return `Hold ${idea.id}; revise or reject the thesis before any new research authority is granted.`;
  }
}

@Component({
  imports: [RouterLink],
  template: `
    <section class="shell studio-hero brief-hero">
      <p class="eyebrow">Founder brief builder</p>
      <h1>Notice the gift before naming the product.</h1>
      <p class="lede">Give the AI team a high-level direction. This private-in-your-browser worksheet checks the thoughtfulness logic, then opens a reviewable owner-authored GitHub issue. It does not start research or publish anything by itself.</p>
      <p><a routerLink="/studio">← Return to Executive Studio</a></p>
    </section>

    <section class="shell compact-section brief-layout">
      <form class="panel brief-form" (submit)="$event.preventDefault()">
        <div class="brief-form-heading">
          <div><p class="eyebrow">1 · Frame the direction</p><h2>What should the team investigate?</h2></div>
          <span class="status" [class.approved_for_research]="assessment.ready">{{ assessment.passed }}/{{ assessment.total }} complete</span>
        </div>

        <label>Idea shape
          <select name="mode" [value]="draft.mode" (change)="updateMode($event)">
            <option value="recipient_friction">One recipient-friction opportunity</option>
            <option value="coherent_pair">Two gifts that create one interaction</option>
          </select>
        </label>
        <label>Strategic direction
          <input name="title" [value]="draft.title" (input)="updateText('title', $event)" maxlength="180" placeholder="Small golf frustrations players tolerate instead of fixing">
        </label>
        <div class="brief-field-grid">
          <label>Recipient or audience
            <input name="audience" [value]="draft.audience" (input)="updateText('audience', $event)" maxlength="180" placeholder="Recreational golfers who play most weekends">
          </label>
          <label>Occasion and timing
            <input name="occasion" [value]="draft.occasion" (input)="updateText('occasion', $event)" maxlength="180" placeholder="Evergreen birthdays and Father’s Day">
          </label>
          <label>Budget boundary
            <input name="budget" [value]="draft.budget" (input)="updateText('budget', $event)" maxlength="80" placeholder="$25–$100">
          </label>
          <label>Geography
            <input name="geography" [value]="draft.geography" (input)="updateText('geography', $event)" maxlength="100">
          </label>
        </div>

        <label>What have you actually noticed?
          <textarea name="observedFriction" [value]="draft.observedFriction" (input)="updateText('observedFriction', $event)" rows="4" maxlength="1200" placeholder="Name the workaround, worn item, repeated complaint, or routine—not a product trend."></textarea>
        </label>
        <label>Why would they welcome it but postpone buying it?
          <textarea name="selfPurchaseGap" [value]="draft.selfPurchaseGap" (input)="updateText('selfPurchaseGap', $event)" rows="4" maxlength="1200" placeholder="Replacement inertia, research burden, a deferred small luxury, or coordination burden—not simply ‘they would never buy it.’"></textarea>
        </label>
        <div class="brief-field-grid">
          <label>Proof-of-fit signals <span>one per line</span>
            <textarea name="fitSignals" [value]="draft.fitSignals" (input)="updateText('fitSignals', $event)" rows="5" maxlength="1400" placeholder="I have seen the workaround&#10;I know the size, platform, routine, or current setup"></textarea>
          </label>
          <label>Reject the idea when <span>one per line</span>
            <textarea name="rejectionConditions" [value]="draft.rejectionConditions" (input)="updateText('rejectionConditions', $event)" rows="5" maxlength="1400" placeholder="They already own a good version&#10;It creates storage, maintenance, or compatibility burden"></textarea>
          </label>
        </div>

        @if (draft.mode === 'coherent_pair') {
          <fieldset class="pair-builder">
            <legend>2 · Make the pair interact</legend>
            <p>A pair must do more than match. Each item should qualify alone, perform a different role, and create one observable use-together moment.</p>
            <div class="brief-field-grid">
              <label>Anchor gift
                <input name="pairAnchor" [value]="draft.pairAnchor" (input)="updateText('pairAnchor', $event)" maxlength="180" placeholder="The idea-opening gift">
              </label>
              <label>Companion gift
                <input name="pairCompanion" [value]="draft.pairCompanion" (input)="updateText('pairCompanion', $event)" maxlength="180" placeholder="The gift that lets them act on it">
              </label>
            </div>
            <label>Different roles and interaction moment
              <textarea name="pairInteraction" [value]="draft.pairInteraction" (input)="updateText('pairInteraction', $event)" rows="4" maxlength="1200" placeholder="Explain what the recipient can do, discuss, test, or notice because the gifts are together."></textarea>
            </label>
            <label>Compatibility, ownership, and clutter checks <span>one per line</span>
              <textarea name="compatibilityChecks" [value]="draft.compatibilityChecks" (input)="updateText('compatibilityChecks', $event)" rows="5" maxlength="1400" placeholder="Confirm platform or edition compatibility&#10;Confirm they do not already own either item"></textarea>
            </label>
          </fieldset>
        }

        <label>Exclusions and guardrails
          <textarea name="exclusions" [value]="draft.exclusions" (input)="updateText('exclusions', $event)" rows="3" maxlength="1000" placeholder="Categories, claims, merchants, subscriptions, geographies, or risks to exclude."></textarea>
        </label>
        <label>What would a successful result help us decide?
          <textarea name="desiredOutcome" [value]="draft.desiredOutcome" (input)="updateText('desiredOutcome', $event)" rows="3" maxlength="1000" placeholder="Five defensible finalists, one evergreen guide, and three testable distribution angles."></textarea>
        </label>

        <fieldset class="authority-checks">
          <legend>3 · Keep authority explicit</legend>
          <label><input type="checkbox" name="authorityConfirmed" [checked]="draft.authorityConfirmed" (change)="updateBoolean('authorityConfirmed', $event)"> I understand this issue can create only a proposed brief. A separate founder approval is required before research.</label>
          <label><input type="checkbox" name="noSensitiveDataConfirmed" [checked]="draft.noSensitiveDataConfirmed" (change)="updateBoolean('noSensitiveDataConfirmed', $event)"> I included no credentials, tracking IDs, private customer data, or private-group content.</label>
        </fieldset>
        @if (assessment.credentialLikeTextDetected) {
          <p class="brief-warning"><strong>Stop:</strong> credential-like text was detected. Remove it before opening GitHub.</p>
        }
      </form>

      <aside class="brief-sidebar">
        <div class="panel brief-readiness">
          <p class="eyebrow">Draft readiness</p>
          <h2>{{ assessment.ready ? 'Ready for founder review.' : 'Strengthen the brief.' }}</h2>
          <ul class="brief-checks">
            @for (check of assessment.checks; track check.id) {
              <li [class.passed]="check.passed"><span aria-hidden="true">{{ check.passed ? '✓' : '○' }}</span>{{ check.label }}</li>
            }
          </ul>
          @if (issueUrl) {
            <a class="button brief-submit" [href]="issueUrl" target="_blank" rel="noopener">Review issue in GitHub →</a>
          } @else {
            <span class="button brief-submit disabled" aria-disabled="true">Complete the missing decisions</span>
          }
          <p class="quiet">GitHub shows the final issue before submission. Submitting it starts only the proposal workflow; it does not approve research.</p>
        </div>
        <div class="panel brief-prompts">
          <p class="eyebrow">Use observation, not assumption</p>
          <h3>Signals worth bringing to the team</h3>
          <ul>
            <li>A workaround they repeat.</li>
            <li>A worn item they tolerate.</li>
            <li>A small upgrade deferred behind bigger purchases.</li>
            <li>Two interests that become one shared activity.</li>
          </ul>
        </div>
        <details class="panel brief-preview-card">
          <summary>Preview the exact issue body</summary>
          <pre class="brief-preview">{{ briefMarkdown }}</pre>
        </details>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FounderBriefPage {
  readonly draft: FounderBriefDraft = { ...EMPTY_FOUNDER_BRIEF };
  private readonly seo = inject(SeoService);
  constructor() {
    this.seo.set({ title: 'Founder brief builder', description: 'Compose a thoughtful, bounded strategy brief for the Tips for Your Gifts research team.', path: '/studio/brief', noindex: true });
  }
  get assessment() { return assessFounderBrief(this.draft); }
  get issueUrl() { return buildStrategyIssueUrl(this.draft); }
  get briefMarkdown() { return buildFounderBriefMarkdown(this.draft); }
  updateMode(event: Event) { this.draft.mode = (event.target as HTMLSelectElement).value as FounderBriefDraft['mode']; }
  updateText(field: Exclude<keyof FounderBriefDraft, 'mode' | 'authorityConfirmed' | 'noSensitiveDataConfirmed'>, event: Event) {
    this.draft[field] = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
  updateBoolean(field: 'authorityConfirmed' | 'noSensitiveDataConfirmed', event: Event) {
    this.draft[field] = (event.target as HTMLInputElement).checked;
  }
}
