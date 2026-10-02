import config from "../../config/env.settings.js";
import { ChunkingFileExtension } from "../services/index.js";
import { runIngest } from "./ingest.js";

try {
  await runIngest(
    config.docsPath,
    config.separator,
    config.extention as ChunkingFileExtension,
    config.targetChunkSize,
    config.chunkSizeTolerance,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido";

  console.error(`Error durante la ingestión: ${message}`);
  process.exitCode = 1;
}
