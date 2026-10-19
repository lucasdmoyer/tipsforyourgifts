# Founder safety review receipts

This directory stores immutable, non-secret receipts for Lucas's review of exact high-risk claim wording. A receipt binds one research run, article, optional social pack, their SHA-256 digests, and the complete high-risk claim set.

A receipt approves only the quoted safety boundary. It does not certify evidence, replace independent editorial review, make an article publication-ready, authorize affiliate tracking, publish social content, create a Firebase preview, or authorize production deployment.

Receipts are created only by the repository-owner GitHub workflow on `master`, receive a GitHub OIDC byte attestation, and are bound back into the research run before independent QA. Release workflows verify the successful workflow provenance and attestation. A generic safety blocker without at least one exact high-risk claim is not approvable; it returns to drafting for claim classification.
