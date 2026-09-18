// Headless build: `npm run generate` (all demos) or `npm run generate -- kladi`.
import { runPipeline, DEMOS } from './run.mjs';

const targets = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const demos = targets.length ? targets : DEMOS;
const quiet = process.argv.includes('--quiet');

for (const demo of demos) {
  console.log(`\n▸ ${demo}`);
  const manifest = await runPipeline(demo, {
    onEvent: (e) => {
      if (e.type === 'stage' && e.status === 'done') console.log(`  ✓ ${e.stage.padEnd(9)} ${String(e.ms).padStart(4)}ms  ${e.summary}`);
      if (e.type === 'log' && !quiet && e.stage !== 'pages') console.log(`      ${e.message}`);
    },
  });
  console.log(`  → out/${demo}/site  (${manifest.counts.pages} pages, ${manifest.findings.length} findings)`);
}
