# Official social publication receipts

One immutable JSON receipt is written only after an official platform API returns HTTP 201 and a verifiable external post ID. Draft packs remain immutable; this directory is the source of publication truth.

A content approval, workflow run, branch, or queued draft is never publication proof. If an API call succeeds but later Git steps fail, recover the uploaded workflow artifact and record the receipt before considering any retry.
