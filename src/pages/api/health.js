import { checkDatabaseHealth } from "../../db/db";
import config from "../../lib/config";
import { sendErrorAlert, sendWarningAlert, sendInfoAlert } from "../../lib/alerts";

/**
 * Endpoint de verificação de saúde do sistema
 * Verifica as conexões de banco de dados e outras dependências
 * Gera alertas quando necessário
 * 
 * Este endpoint não tem restrições de CORS para permitir monitoramento externo.
 */
export default async function handler(req, res) {
  // Habilitar CORS para este endpoint específico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Responder imediatamente a requisições OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Verificar se é pedido de geração de alerta de teste (para validar configuração)
  const testAlert = req.query.test_alert;
  if (testAlert && req.method === 'GET') {
    try {
      // Apenas gerar teste se houver autorização ou estiver em desenvolvimento
      const monitorSecret = process.env.MONITOR_SECRET;
      const isAuthorized = monitorSecret && req.headers.authorization === `Bearer ${monitorSecret}`;
      const isLocalRequest = req.headers.host && 
        (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
        
      if (isAuthorized || isLocalRequest || !config.system.isProduction) {
        if (testAlert === 'error') {
          await sendErrorAlert('Teste de alerta de erro', { source: 'health-check', test: true });
        } else if (testAlert === 'warning') {
          await sendWarningAlert('Teste de alerta de aviso', { source: 'health-check', test: true });
        } else {
          await sendInfoAlert('Teste de alerta informativo', { source: 'health-check', test: true });
        }
        
        return res.status(200).json({ 
          status: 'ok',
          message: `Alerta de teste '${testAlert}' enviado com sucesso`
        });
      }
    } catch (error) {
      console.error('❌ Erro ao enviar alerta de teste:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Não foi possível enviar alerta de teste',
        error: error.message 
      });
    }
  }
  
  // Apenas permitir GET para verificação de saúde
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Verificar saúde do banco de dados
    const dbHealth = await checkDatabaseHealth();
    
    // Status básico - seguro para exposição pública
    const basicStatus = {
      status: dbHealth.connected ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: config.system.nodeEnv
    };
    
    // Verificar alertas automáticos
    // Flag para evitar envio duplicado de alertas
    const shouldAlert = req.query.alert !== 'false';
    
    // Verificar problema de saúde e gerar alerta se necessário
    if (shouldAlert && !dbHealth.connected) {
      await sendErrorAlert('Problema de conexão com o banco de dados', {
        source: 'health-check',
        error: dbHealth.error,
        code: dbHealth.code
      });
    }
    
    // Verificar se JWT está configurado corretamente
    const isJwtConfigured = !!config.auth.jwtSecret && 
      config.auth.jwtSecret !== 'dev_jwt_secret_unsafe';
      
    if (shouldAlert && config.system.isProduction && !isJwtConfigured) {
      await sendWarningAlert('JWT_SECRET não configurado corretamente', {
        source: 'health-check'
      });
    }
    
    // Se o header de autorização estiver presente e corresponder ao segredo de monitoramento
    // OU se a solicitação vier de localhost/127.0.0.1
    const monitorSecret = process.env.MONITOR_SECRET;
    const isAuthorized = monitorSecret && 
      req.headers.authorization === `Bearer ${monitorSecret}`;
    const isLocalRequest = req.headers.host && 
      (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
    
    // Verificar se devemos mostrar informações detalhadas
    const showDetails = 
      (req.query.detailed === 'true' && (isAuthorized || isLocalRequest)) || 
      (!config.system.isProduction && req.query.detailed === 'true');
    
    if (showDetails) {
      // Status detalhado - apenas para monitoramento autorizado
      const detailedStatus = {
        ...basicStatus,
        version: process.env.npm_package_version || 'desconhecida',
        server: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          }
        },
        database: {
          connected: dbHealth.connected,
          status: dbHealth.status,
          host: config.db.host.split('.')[0] + '.***.***', // Omitir parte do hostname por segurança
          ssl: !!config.db.ssl
        },
        config: {
          valid: config.system.configValid,
          corsConfigured: config.cors.allowedOrigins.length > 0,
          jwtConfigured: isJwtConfigured,
          stripeConfigured: !!config.stripe.secretKey && !config.stripe.secretKey.includes('sk_test_123')
        },
        alerts: {
          discord: !!process.env.DISCORD_WEBHOOK_URL,
          email: process.env.EMAIL_ALERTS_ENABLED === 'true' && !!process.env.EMAIL_ALERTS_TO
        }
      };
      
      // Responder com código de status apropriado
      const statusCode = dbHealth.connected ? 200 : 503;
      return res.status(statusCode).json(detailedStatus);
    }
    
    // Responder com status básico para solicitações não autorizadas
    return res.status(dbHealth.connected ? 200 : 503).json(basicStatus);
    
  } catch (error) {
    console.error('❌ Erro ao verificar saúde do sistema:', error);
    
    // Tentar enviar alerta de erro
    try {
      if (req.query.alert !== 'false') {
        await sendErrorAlert('Erro ao verificar saúde do sistema', {
          source: 'health-check',
          error: error.message
        });
      }
    } catch (alertError) {
      console.error('Erro ao enviar alerta:', alertError);
    }
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Erro interno ao verificar saúde do sistema'
    });
  }
} 