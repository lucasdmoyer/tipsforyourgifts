# Visual production queue

Research agents may create one `requested` JSON record here when a new draft article does not yet have an approved entry in `visuals/article-visuals.json`.

The request is a brief, not an image approval. It binds the exact draft article and research run, reuses the founder-approved Gift-Thread visual system, forbids public asset paths, and keeps image generation, responsive derivatives, registry changes, and independent visual QA in a separate production stage.

Pending requests must never make an article publication-ready or eligible for automatic merge. Once a separate visual-production change creates and independently reviews the complete visual set, that change removes the pending request and advances the still-active research mission through the ordinary publication gates.
