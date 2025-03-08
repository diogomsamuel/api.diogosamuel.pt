import config from './config';

export function allowCors(handler) {
  return async (req, res) => {
    // Obter valores da configuração centralizada
    const isDevelopment = config.system.isDevelopment;
    const allowedOrigins = config.cors.allowedOrigins;
    const allowAnyOriginInDev = config.cors.allowAnyOriginInDev;
    const allowPostman = config.cors.allowPostman;
    
    const origin = req.headers.origin || "";
    const userAgent = req.headers["user-agent"] || "";
    const method = req.method || "UNKNOWN";
    const path = req.url || "UNKNOWN";

    // Log diagnóstico para depuração
    console.log(`[CORS] 🔍 Recebida requisição: ${method} ${path}`);
    console.log(`[CORS] 🔍 Origem: "${origin}"`);
    console.log(`[CORS] 🔍 Origens permitidas:`, allowedOrigins);
    console.log(`[CORS] 🔍 Em modo desenvolvimento:`, isDevelopment);
    console.log(`[CORS] 🔍 Headers recebidos:`, Object.keys(req.headers).join(', '));

    // Verificar se é uma requisição do Postman
    const isPostmanRequest = userAgent.includes("Postman");
    
    // Verificar solicitações sem origem (pode ser um bot ou um teste de segurança)
    if (!origin && !isPostmanRequest) {
      // Em desenvolvimento, podemos permitir solicitações sem origem para facilitar testes
      if (isDevelopment) {
        console.warn(`[CORS] ⚠️ Solicitação sem origem permitida em DEV: ${method} ${path}`);
      } else {
        // Em produção, verificar se é uma chamada de API
        if (req.headers.authorization && (path.includes('/api/admin') || path.includes('/api/verify'))) {
          console.log(`[CORS] ✅ Chamada de API autenticada sem origem é permitida: ${method} ${path}`);
        } else {
          // Em produção, logue e bloqueie solicitações sem origem
          console.warn(`[CORS] 🚫 Solicitação sem origem bloqueada: ${method} ${path}`);
          return res.status(403).json({ error: "Acesso negado: Origem não especificada" });
        }
      }
    }

    // Verifica se a origem está permitida
    const isOriginAllowed = allowedOrigins.includes(origin);
    
    // IMPORTANTE: Como estamos usando credentials (cookies, auth headers),
    // não podemos usar Access-Control-Allow-Origin: * mesmo em desenvolvimento
    // Em vez disso, sempre devemos especificar a origem exata
    
    // Em desenvolvimento, podemos ser mais flexíveis
    if (isDevelopment) {
      // Em desenvolvimento, permitir origens específicas se configurado
      if (allowAnyOriginInDev && origin) {
        console.warn(`[CORS] ⚠️ Permitindo origem em DEV: ${origin}`);
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else if (isOriginAllowed || (allowPostman && isPostmanRequest)) {
        console.log(`[CORS] ✅ Origem permitida em DEV: ${origin}`);
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else {
        console.warn(`[CORS] 🚫 Origem bloqueada em DEV: ${origin}`);
        return res.status(403).json({ error: "Acesso negado: Origem não autorizada" });
      }
    } else {
      // Em produção, ser mais rigoroso
      if (isOriginAllowed || (allowPostman && isPostmanRequest)) {
        console.log(`[CORS] ✅ Origem permitida: ${origin}`);
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else if (!origin && req.headers.authorization) {
        // Para solicitações de API sem origem, mas com autenticação, podemos permitir
        console.log(`[CORS] ✅ Requisição autenticada sem origem permitida`);
      } else {
        console.warn(`[CORS] 🚫 Origem bloqueada: ${origin}`);
        return res.status(403).json({ error: "Acesso negado: Origem não autorizada" });
      }
    }

    // Definir corretamente os headers CORS
    res.setHeader("Access-Control-Allow-Credentials", "true"); // Permite cookies e sessões autenticadas
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST, PUT, DELETE, PATCH");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-Requested-With, Content-Type, Authorization, Cookie, Set-Cookie, Accept"
    );
    
    // Configurar o tempo de cache para preflight em produção (10 minutos)
    if (!isDevelopment && req.method === "OPTIONS") {
      res.setHeader("Access-Control-Max-Age", "600");
    }

    // Responde imediatamente a requisições OPTIONS (Preflight)
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    return handler(req, res);
  };
}