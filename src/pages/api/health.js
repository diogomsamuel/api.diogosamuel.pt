import config from "../../lib/config";
import { sendErrorAlert, sendWarningAlert, sendInfoAlert } from "../../lib/alerts";
import { allowCors } from "../../lib/cors";

/**
 * Endpoint para verificar a saúde do sistema
 * Monitora componentes críticos e envia alertas
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handler(req, res) {
  // Verificamos se o método é GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Obter componentes para verificar do config ou da query
    const components = req.query.components 
      ? req.query.components.split(',') 
      : ['api', 'system'];
      
    // Resultados das verificações
    const results = {};
    const alerts = [];
    let systemStatus = "healthy";
    
    // === 1. Verificar API ===
    if (components.includes('api')) {
      results.api = {
        status: "healthy",
        message: "API funcionando normalmente",
        timestamp: new Date().toISOString()
      };
    }
    
    // === 2. Verificar configuração do sistema ===
    if (components.includes('system')) {
      const missingConfigs = [];
      
      // Verificar se as configurações críticas estão presentes
      if (!config.database.host) missingConfigs.push('DB_HOST');
      if (!config.database.user) missingConfigs.push('DB_USER');
      if (!config.database.name) missingConfigs.push('DB_NAME');
      if (!config.auth.jwtSecret) missingConfigs.push('JWT_SECRET');
      
      if (missingConfigs.length > 0) {
        results.system = {
          status: "warning",
          message: `Configurações ausentes: ${missingConfigs.join(', ')}`,
          missingConfigs
        };
        systemStatus = "warning";
        alerts.push({
          type: "warning",
          message: `Configurações do sistema ausentes: ${missingConfigs.join(', ')}`
        });
      } else {
        results.system = {
          status: "healthy",
          message: "Configuração do sistema está completa"
        };
      }
    }
    
    // === 3. Verificar status de alertas ===
    if (components.includes('alerts')) {
      try {
        // Enviar alerta de teste se solicitado
        if (req.query.sendTestAlert === 'true') {
          await sendInfoAlert('Alerta de teste do sistema de monitoramento');
          results.alerts = {
            status: "healthy",
            message: "Sistema de alertas funcionando (alerta de teste enviado)",
            testAlertSent: true
          };
        } else {
          results.alerts = {
            status: "healthy",
            message: "Sistema de alertas está configurado"
          };
        }
      } catch (error) {
        results.alerts = {
          status: "warning",
          message: "Sistema de alertas com erro: " + error.message
        };
        systemStatus = "warning";
      }
    }
    
    // === 4. Verificar parâmetros gerais da requisição ===
    if (components.includes('request')) {
      results.request = {
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          userAgent: req.headers['user-agent'],
          acceptLanguage: req.headers['accept-language']
        },
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      };
    }
    
    // === 5. Verificar informações de ambiente ===
    if (components.includes('environment')) {
      results.environment = {
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        hostname: process.env.HOSTNAME || 'unknown'
      };
    }
    
    // Agregar resultado final
    const healthResult = {
      status: systemStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      results
    };
    
    // Se há alertas, incluí-los na resposta
    if (alerts.length > 0) {
      healthResult.alerts = alerts;
    }
    
    // Decidir status HTTP com base no status do sistema
    const httpStatus = systemStatus === "healthy" ? 200 : 
                      systemStatus === "warning" ? 200 : 500;
    
    return res.status(httpStatus).json(healthResult);
    
  } catch (error) {
    console.error("Erro ao verificar saúde do sistema:", error);
    
    // Enviar alerta de erro
    try {
      await sendErrorAlert(`Erro crítico no health check: ${error.message}`);
    } catch (alertError) {
      console.error("Falha ao enviar alerta:", alertError);
    }
    
    return res.status(500).json({
      status: "error",
      message: "Erro interno ao verificar saúde do sistema",
      error: config.system.isDevelopment ? error.message : "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
}

// Aplicar middleware CORS
export default allowCors(handler); 