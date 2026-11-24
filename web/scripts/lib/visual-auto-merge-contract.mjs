export function resolveVisualAutoMerge({ route, publicationPolicy, mission }) {
  if (route !== 'promotion') return { eligible: false, reason: 'non_promotion_route' };
  if (!publicationPolicy.automaticPromotion.enabled || publicationPolicy.mode !== 'automatic_after_proven') {
    return { eligible: false, reason: 'automatic_publication_disabled' };
  }
  if (mission.status !== 'completed' || !mission.completion) return { eligible: false, reason: 'mission_not_completed' };
  if (mission.publicationPolicySnapshot.mode !== 'automatic_after_proven' || !mission.publicationPolicySnapshot.automaticPromotionEnabled) {
    return { eligible: false, reason: 'mission_started_under_founder_review' };
  }
  if (mission.completion.publicationReadiness !== 'automatic_merge_eligible') {
    return { eligible: false, reason: 'mission_requires_founder_review' };
  }
  return {
    eligible: true,
    reason: 'proven_policy_and_mission_eligible',
    missionId: mission.missionId,
    articleSlug: mission.completion.articleSlug
  };
}
