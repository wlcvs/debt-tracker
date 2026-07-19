// Manual evaluation script — NOT part of `npm run test:run`/CI.
//
// Compares the LLM-extraction path across models against the algorithmic
// parser's known-correct output, on the real (gitignored) fixture PDFs.
// Requires:
//   - A live Ollama server at OLLAMA_BASE_URL (see .env / .env.example).
//   - The fixture PDFs present locally in src/lib/__tests__/fixtures/.
//   - Any model under test already pulled (`ollama pull <tag>`).
//
// On a machine where the `ollama` binary isn't on PATH (e.g. installed to
// ~/.local/ollama/bin), prefix with: export PATH="$HOME/.local/ollama/bin:$PATH"
//
// Usage:
//   npm run eval:llm
//   MODELS=qwen2.5:3b,qwen2.5:1.5b npm run eval:llm
//   LLM_CHUNK_SIZE=4 npm run eval:llm
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const { detectAndParse } = await import(path.join(REPO_ROOT, "src/lib/importers/index.ts"));
const dispatch = await import(path.join(REPO_ROOT, "src/lib/llm-extract/dispatch.ts"));

const FIXTURES_DIR = path.join(REPO_ROOT, "src/lib/__tests__/fixtures");
const FILES = [
  "8b5e4279-81c5-4df5-a4a9-1f403bdf7155.pdf", // Bradesco
  "credit-card-mp-statement.pdf", // Mercado Pago
  "Fatura_Itau_20260629-180424.pdf", // Itau
  "Nubank_2026-07-11.pdf", // Nubank fatura
];

const MODELS = (process.env.MODELS ?? "qwen2.5:3b,hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:Q8_0")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

function norm(t) {
  return `${t.date}|${Number(t.amount).toFixed(2)}`;
}

function compare(algoTxns, llmTxns) {
  const algoKeys = new Set(algoTxns.map(norm));
  const llmKeys = new Set(llmTxns.map(norm));
  const matched = [...algoKeys].filter((k) => llmKeys.has(k));
  const missed = [...algoKeys].filter((k) => !llmKeys.has(k));
  const hallucinated = [...llmKeys].filter((k) => !algoKeys.has(k));
  return { matched: matched.length, total: algoKeys.size, missed, hallucinated: hallucinated.length, hallucinatedKeys: hallucinated };
}

for (const model of MODELS) {
  process.env.OLLAMA_MODEL = model;
  console.log(`\n=== MODEL: ${model}${process.env.LLM_CHUNK_SIZE ? ` (chunk size ${process.env.LLM_CHUNK_SIZE})` : ""} ===`);

  let totalMatched = 0;
  let totalExpected = 0;
  let totalHallucinated = 0;
  let totalTimeMs = 0;

  for (const file of FILES) {
    const p = path.join(FIXTURES_DIR, file);
    if (!fs.existsSync(p)) {
      console.log(`${file} — fixture not present locally, skipping`);
      continue;
    }
    const data = fs.readFileSync(p);
    const algo = await detectAndParse(data);
    const bank = algo.bank;

    const start = Date.now();
    const [llmTxns] = await dispatch.extract(data, bank, []);
    const elapsed = Date.now() - start;
    totalTimeMs += elapsed;

    const cmp = compare(algo.transactions, llmTxns);
    totalMatched += cmp.matched;
    totalExpected += cmp.total;
    totalHallucinated += cmp.hallucinated;

    console.log(
      `${file} [${bank}] — algo:${cmp.total} matched:${cmp.matched} missed:${cmp.missed.length} hallucinated:${cmp.hallucinated} time:${elapsed}ms`
    );
    if (cmp.missed.length) console.log(`   missed: ${cmp.missed.join(", ")}`);
    if (cmp.hallucinatedKeys.length) console.log(`   hallucinated: ${cmp.hallucinatedKeys.join(", ")}`);
  }

  console.log(
    `--- TOTAL for ${model}: ${totalMatched}/${totalExpected} matched, ${totalHallucinated} hallucinated, ${totalTimeMs}ms total (${Math.round(totalTimeMs / FILES.length)}ms avg) ---`
  );
}
