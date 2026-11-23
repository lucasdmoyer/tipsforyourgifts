import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { sha256, visualProductionDirectory, visualProductionManifestSchema } from './lib/visual-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const requestId = args['request-id'];
const modelOutcome = args['model-outcome'];
if (!requestId || !modelOutcome) throw new Error('Usage: node scripts/classify-visual-production-output.mjs --request-id=<id> --model-outcome=<success|failure>');

const root = process.cwd();
const result = { productionOutcome: 'failed', failureCode: modelOutcome === 'success' ? 'production_bundle_invalid' : 'production_step_failed', manifestSha256: null, issueCodes: [] };
const finish = async () => {
  result.issueCodes = [...new Set(result.issueCodes)].sort();
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `production_outcome=${result.productionOutcome}\nproduction_failure_code=${result.failureCode ?? ''}\nmanifest_sha256=${result.manifestSha256 ?? ''}\n`);
  console.log(JSON.stringify(result, null, 2));
};
if (modelOutcome !== 'success') {
  result.issueCodes.push('production_step_failed');
  await finish();
  process.exit(0);
}

try {
  const directory = visualProductionDirectory(requestId);
  const manifestRaw = await fs.readFile(path.join(root, directory, 'manifest.json'));
  const manifest = visualProductionManifestSchema.parse(JSON.parse(manifestRaw));
  if (manifest.requestId !== requestId) result.issueCodes.push('manifest_request_mismatch');
  for (const asset of manifest.assets) {
    for (const [record, format] of [[asset.source, 'png'], [asset.delivery, 'webp'], ...asset.derivatives.map((entry) => [entry, 'webp'])]) {
      const bytes = await fs.readFile(path.join(root, record.path));
      if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) result.issueCodes.push('asset_integrity_invalid');
      const metadata = await sharp(bytes).metadata();
      if (metadata.format !== format || metadata.width !== record.width || metadata.height !== record.height) result.issueCodes.push('asset_dimensions_invalid');
    }
  }
  if (result.issueCodes.length === 0) {
    result.productionOutcome = 'ready';
    result.failureCode = null;
    result.manifestSha256 = sha256(manifestRaw);
  }
} catch {
  result.issueCodes.push('production_bundle_unreadable');
}
await finish();
