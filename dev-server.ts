import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app, PORT_NUMBER } from "./server.js";

// Acopla o Vite (dev) ou os arquivos estáticos da build (produção self-hosted)
// ao app Express e sobe o processo de longa duração. Usado por `npm run dev`
// e `npm start` — NÃO é usado na Vercel, que importa o app diretamente como
// função serverless (ver api/[...path].ts).
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware do desenvolvimento acoplado ao Express.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Servidor Express acoplado à build de produção estática.");
  }

  app.listen(PORT_NUMBER, "0.0.0.0", () => {
    console.log(`Kadosh Manager rodando com sucesso no endereço http://localhost:${PORT_NUMBER}`);
  });
}

startServer();
