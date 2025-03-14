/**
 * Configuração centralizada do sistema
 * 
 * Este módulo centraliza o acesso a todas as variáveis de ambiente e configurações,
 * validando-as e fornecendo valores padrão para desenvolvimento.
 * 
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
 * 
 * Banco de Dados (Aiven):
 * - DB_HOSTNAME: Host do MySQL/MariaDB
 * - DB_PORT: Porta do banco de dados
 * - DB_USER: Usuário do banco
 * - DB_PASSWORD: Senha do banco
 * - DB_NAME: Nome da base de dados
 * - DB_SSL_CA_BASE64: Certificado SSL do Aiven em Base64
 * 
 * Autenticação:
 * - JWT_SECRET: Chave para assinar tokens JWT
 * - COOKIE_DOMAIN: Domínio para definir cookies (.diogosamuel.pt)
 * 
 * CORS:
 * - CORS_ALLOWED_ORIGINS_REMOTE: Lista de origens permitidas em produção
 * - CORS_ALLOW_ANY_DEV: Permitir qualquer origem em DEV (true/false)
 * - POSTMAN_ALLOWED: Permitir acesso via Postman (true/false)
 * 
 * URLs:
 * - FRONTEND_URL: URL do frontend (https://www.diogosamuel.pt)
 * - DASHBOARD_URL: URL do painel admin (https://admin.diogosamuel.pt)
 * 
 * Blockchain:
 * - ADMIN_WALLET: Endereço da carteira do super administrador
 * - BLOCKCHAIN_RPC_URL: URL RPC Ethereum
 * 
 * Stripe:
 * - STRIPE_SECRET_KEY: Chave secreta do Stripe
 * - STRIPE_WEBHOOK_SECRET: Secret para verificação de webhooks
 * - STRIPE_SUCCESS_URL: URL de retorno após pagamento
 * - STRIPE_CANCEL_URL: URL de cancelamento de pagamento
 */

// Utilitário para validar variáveis de ambiente
function validateEnv(key, defaultValue = null, required = true) {
  const value = process.env[key];
  const isDev = process.env.NODE_ENV === 'development';
  
  // Em modo de desenvolvimento, podemos fornecer valores padrão para facilitar testes
  if ((!value || value.trim() === '') && defaultValue !== null && isDev) {
    return defaultValue;
  }
  
  // Se a variável for obrigatória e não existir, emitir um aviso
  if ((!value || value.trim() === '') && required) {
    console.warn(`⚠️ AVISO: Variável de ambiente ${key} não está definida!`);
    
    // Em produção, registrar um erro mais grave
    if (!isDev) {
      console.error(`❌ ERRO CRÍTICO: Variável de ambiente obrigatória ${key} não definida em produção!`);
    }
  }
  
  return value || defaultValue;
}

// Função para decodificar o certificado SSL do Aiven
function getSSLConfig() {
  const sslCABase64 = process.env.DB_SSL_CA_BASE64;
  
  if (!sslCABase64) {
    return undefined;
  }
  
  try {
    // Decodificar o certificado Base64 para texto UTF-8
    const ca = Buffer.from(sslCABase64, 'base64').toString('utf-8');
    return { ca };
  } catch (error) {
    console.error('❌ ERRO ao decodificar certificado SSL:', error.message);
    return undefined;
  }
}

// Configurações do banco de dados (especial atenção para Aiven)
const dbConfig = {
  // Informações básicas de conexão
  host: validateEnv('DB_HOSTNAME', 'localhost'),
  port: validateEnv('DB_PORT', '3306'),
  user: validateEnv('DB_USER', 'root'),
  password: validateEnv('DB_PASSWORD', ''),
  database: validateEnv('DB_NAME', 'training'),
  
  // Configurações de conexão
  waitForConnections: true,
  connectionLimit: parseInt(validateEnv('DB_CONNECTION_LIMIT', '10', false)) || 10,
  queueLimit: 0,
  connectTimeout: parseInt(validateEnv('DB_CONNECT_TIMEOUT', '10000', false)) || 10000,
  
  // Configuração SSL (importante para Aiven)
  ssl: getSSLConfig(),
  
  // Configurações adicionais para ambientes específicos
  charset: validateEnv('DB_CHARSET', 'utf8mb4', false),
  timezone: validateEnv('DB_TIMEZONE', 'local', false),
};

// Configurações de autenticação
const authConfig = {
  jwtSecret: validateEnv('JWT_SECRET', 'dev_jwt_secret_unsafe'),
  tokenExpire: validateEnv('JWT_EXPIRES', '2h', false) || '2h',
  cookieDomain: validateEnv('COOKIE_DOMAIN', '.diogosamuel.pt', false),
  cookieMaxAge: parseInt(validateEnv('COOKIE_MAX_AGE', '7200', false)) || 7200, // 2 horas em segundos
};

// Configurações de CORS
const corsConfig = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
    [
      // Frontend principal
      'https://www.diogosamuel.pt',
      'https://diogosamuel.pt',
      
      // Admin dashboard
      'https://admin.diogosamuel.pt',
      
      // URLs de desenvolvimento local - REMOVIDO
      // 'http://localhost:3000',
      // 'http://localhost:3002',
    ]
  ),
  allowAnyOriginInDev: process.env.ALLOW_ANY_ORIGIN_IN_DEV === 'true' || false,
  allowPostman: process.env.ALLOW_POSTMAN === 'true' || true,
};

// Log para debugging
console.log('==== CONFIGURAÇÃO CORS ====');
console.log('Origens permitidas:', corsConfig.allowedOrigins);
console.log('Permitir qualquer origem em DEV:', corsConfig.allowAnyOriginInDev);
console.log('Permitir Postman:', corsConfig.allowPostman);
console.log('============================');

// URLs da aplicação
const appUrls = {
  frontend: validateEnv('FRONTEND_URL', 'http://localhost:3000'),
  admin: validateEnv('DASHBOARD_URL', 'http://localhost:3001'),
};

// Configurações de pagamento (Stripe)
const stripeConfig = {
  secretKey: validateEnv('STRIPE_SECRET_KEY', 'sk_test_123', false),
  webhookSecret: validateEnv('STRIPE_WEBHOOK_SECRET', 'whsec_123', false),
  successUrl: validateEnv('STRIPE_SUCCESS_URL', 'http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}', false),
  cancelUrl: validateEnv('STRIPE_CANCEL_URL', 'http://localhost:3000/payment-cancel', false),
};

// Configurações do blockchain
const blockchainConfig = {
  adminWallet: validateEnv('ADMIN_WALLET', '0x0000000000000000000000000000000000000000', false),
  rpcUrl: validateEnv('BLOCKCHAIN_RPC_URL', 'https://rpc.ankr.com/eth', false),
};

// Configurações do admin
const adminConfig = {
  username: validateEnv('ADMIN_USERNAME', 'admin', false),
  password: validateEnv('ADMIN_PASSWORD', 'admin', false),
};

// Verificar se todas as configurações críticas estão definidas
function validateConfig() {
  const isDev = process.env.NODE_ENV === 'development';
  let hasErrors = false;
  
  // Validar configurações críticas que precisam funcionar mesmo em desenvolvimento
  if (!authConfig.jwtSecret || authConfig.jwtSecret === 'dev_jwt_secret_unsafe') {
    if (!isDev) {
      console.error('❌ ERRO CRÍTICO: JWT_SECRET não configurado corretamente em produção!');
      hasErrors = true;
    } else {
      console.warn('⚠️ AVISO: JWT_SECRET usando valor inseguro de desenvolvimento!');
    }
  }
  
  // Validar conexão do banco de dados
  if (!dbConfig.host || !dbConfig.database) {
    console.error('❌ ERRO CRÍTICO: Configuração de banco de dados incompleta!');
    hasErrors = true;
  }
  
  // Em produção, fazer validações mais rigorosas
  if (!isDev) {
    if (corsConfig.allowedOrigins.length === 0) {
      console.error('❌ ERRO CRÍTICO: Nenhuma origem CORS configurada em produção!');
      hasErrors = true;
    }
    
    if (dbConfig.password === '') {
      console.error('❌ ERRO CRÍTICO: Senha do banco de dados não configurada em produção!');
      hasErrors = true;
    }
    
    // Verificação específica para Aiven - SSL em produção
    if (!dbConfig.ssl && !process.env.DB_DISABLE_SSL) {
      console.warn('⚠️ AVISO: Conexão de banco de dados sem SSL em produção! Recomendado para Aiven.');
    }
  }
  
  return !hasErrors;
}

// Informações do sistema
const system = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  serverStartTime: new Date(),
  configValid: validateConfig(),
};

// Configuração completa da aplicação
const appConfig = {
  db: dbConfig,
  auth: authConfig,
  cors: corsConfig,
  urls: appUrls,
  stripe: stripeConfig,
  blockchain: blockchainConfig,
  admin: adminConfig,
  system,
};

// Exportar todas as configurações
export default appConfig; 