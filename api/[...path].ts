import { app } from "../server.js";

// O Express app já tem a assinatura (req, res) que a Vercel espera de uma
// Function — não precisa (e não deve) ser embrulhado por serverless-http,
// que foi feito para o formato de evento da AWS Lambda e não para os
// objetos de requisição reais que a Vercel entrega aqui.
export default app;
