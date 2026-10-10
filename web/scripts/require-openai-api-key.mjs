const key = process.env.OPENAI_API_KEY?.trim();

if (!key) {
  console.error(
    '::error title=Autonomous agent credential missing::Repository secret OPENAI_API_KEY is required for this model job. Add it through GitHub Settings > Secrets and variables > Actions. No model call was attempted and no secret value was printed.'
  );
  process.exit(1);
}

console.log('Autonomous agent credential preflight passed; the secret value was not printed.');
