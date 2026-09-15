import { build } from "esbuild";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type RouteModule = {
  default: Parameters<Express["use"]>[1];
};

type RunningRoute = {
  url: string;
  close: () => Promise<void>;
};

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

async function bundleTypeScriptModule(entryPoint: string): Promise<{
  moduleUrl: string;
  cleanup: () => Promise<void>;
}> {
  const outputDirectory = await mkdtemp(
    path.join(testDirectory, ".route-bundle-"),
  );
  const outputFile = path.join(outputDirectory, "module.mjs");

  try {
    await build({
      entryPoints: [entryPoint],
      bundle: true,
      external: ["express", "pg"],
      format: "esm",
      logLevel: "silent",
      outfile: outputFile,
      platform: "node",
      sourcemap: false,
    });

    return {
      moduleUrl: pathToFileURL(outputFile).href,
      cleanup: () => rm(outputDirectory, { force: true, recursive: true }),
    };
  } catch (error) {
    await rm(outputDirectory, { force: true, recursive: true });
    throw error;
  }
}

export async function importTypeScriptModule<T>(
  entryPoint: string,
): Promise<T> {
  const bundle = await bundleTypeScriptModule(entryPoint);

  try {
    return (await import(bundle.moduleUrl)) as T;
  } finally {
    await bundle.cleanup();
  }
}

export async function serveTypeScriptRoute(
  entryPoint: string,
  mountPath = "/api",
): Promise<RunningRoute> {
  const bundle = await bundleTypeScriptModule(entryPoint);

  try {
    const route = (await import(bundle.moduleUrl)) as RouteModule;
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(mountPath, route.default);
    const server = await listen(app);
    const address = server.address();

    if (!address || typeof address === "string") {
      await closeServer(server);
      throw new Error("Route test server did not expose a TCP address");
    }

    return {
      url: `http://127.0.0.1:${address.port}`,
      close: async () => {
        await closeServer(server);
        await bundle.cleanup();
      },
    };
  } catch (error) {
    await bundle.cleanup();
    throw error;
  }
}

function listen(app: Express): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
