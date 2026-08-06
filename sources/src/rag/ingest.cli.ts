import config from "../config/env.settings.js";
import { runIngest } from "./ingest.js";

try {
  await runIngest(config.docsPath);
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido";

  console.error(`Error durante la ingestión: ${message}`);
  process.exitCode = 1;
}
