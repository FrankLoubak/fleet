/**
 * Thin proxy do servidor Express.
 * Em desenvolvimento: integra o Vite como middleware para hot reload.
 * Em produção: serve o SPA (catch-all para index.html) e expõe health check.
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê a versão do package.json para expor no health check
const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json());

  // Health check — retorna status, versão e uptime do processo
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      version: pkg.version,
      uptime: process.uptime(),
    });
  });

  if (process.env.NODE_ENV !== "production") {
    // Desenvolvimento: Vite como middleware para hot reload
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Produção: serve os assets estáticos e redireciona tudo para o SPA
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    // Intencionalmente sem log — use variável de ambiente DEBUG se necessário
  });
}

startServer();
