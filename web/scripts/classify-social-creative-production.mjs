import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { sha256, socialCreativeProductionDirectory, socialCreativeProductionManifestSchema } from './lib/social-creative-production-contract.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((value) => { const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const candidateId = args['candidate-id'];
const modelOutcome = args['model-outcome'];
if (!candidateId || !modelOutcome) throw new Error('Usage: node scripts/classify-social-creative-production.mjs --candidate-id=<id> --model-outcome=<success|failure>');
const result = { productionOutcome: 'failed', failureCode: modelOutcome === 'success' ? 'production-bundle-invalid' : 'production-step-failed', manifestSha256: null, issueCodes: [] };
if (modelOutcome === 'success') {
  try {
    const directory = socialCreativeProductionDirectory(candidateId);
    const raw = await fs.readFile(path.join(process.cwd(), directory, 'manifest.json'));
    const manifest = socialCreativeProductionManifestSchema.parse(JSON.parse(raw));
    if (manifest.candidateId !== candidateId) result.issueCodes.push('candidate-id-mismatch');
    for (const [record, format] of [[manifest.source, 'png'], [manifest.delivery, 'jpeg']]) {
      const bytes = await fs.readFile(path.join(process.cwd(), record.path));
      const metadata = await sharp(bytes).metadata();
      if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) result.issueCodes.push('asset-integrity-invalid');
      if (metadata.format !== format || metadata.width !== record.width || metadata.height !== record.height) result.issueCodes.push('asset-dimensions-invalid');
    }
    if (result.issueCodes.length === 0) { result.productionOutcome = 'ready'; result.failureCode = null; result.manifestSha256 = sha256(raw); }
  } catch { result.issueCodes.push('production-bundle-unreadable'); }
} else result.issueCodes.push('production-step-failed');
result.issueCodes = [...new Set(result.issueCodes)].sort();
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `production_outcome=${result.productionOutcome}\nproduction_failure_code=${result.failureCode ?? ''}\nmanifest_sha256=${result.manifestSha256 ?? ''}\n`);
console.log(JSON.stringify(result, null, 2));
