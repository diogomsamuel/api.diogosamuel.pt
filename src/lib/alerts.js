import axios from 'axios';
import config from './config';

/**
 * Sistema de alertas para monitoramento do sistema
 * Envia notificações quando há problemas de saúde no sistema
 */

// Estado do último alerta para evitar spam
let lastAlertTimestamp = 0;
let lastAlertType = null;
const ALERT_COOLDOWN = 15 * 60 * 1000; // 15 minutos entre alertas do mesmo tipo

/**
 * Envia alerta para os canais configurados
 * @param {string} type - Tipo de alerta (error, warning, info)
 * @param {string} message - Mensagem de alerta
 * @param {Object} data - Dados adicionais para o alerta
 */
export async function sendAlert(type, message, data = {}) {
  try {
    // Evitar spam de alertas do mesmo tipo
    const now = Date.now();
    if (lastAlertType === type && (now - lastAlertTimestamp) < ALERT_COOLDOWN) {
      console.log(`⏳ Alerta do tipo ${type} em cooldown, ignorando.`);
      return;
    }

    // Atualizar estado do último alerta
    lastAlertType = type;
    lastAlertTimestamp = now;

    // Preparar payload do alerta
    const payload = {
      type,
      message,
      timestamp: new Date().toISOString(),
      environment: config.system.nodeEnv,
      source: 'api-diogosamuel',
      data
    };

    console.log(`🔔 Enviando alerta: ${type} - ${message}`);

    // Enviar para webhook do Discord se configurado
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        await axios.post(process.env.DISCORD_WEBHOOK_URL, {
          content: `**[${type.toUpperCase()}]** ${message}`,
          embeds: [{
            title: `Alerta de Sistema - ${config.system.nodeEnv}`,
            color: type === 'error' ? 16711680 : type === 'warning' ? 16776960 : 5592575,
            fields: [
              { name: 'Tipo', value: type, inline: true },
              { name: 'Ambiente', value: config.system.nodeEnv, inline: true },
              { name: 'Timestamp', value: payload.timestamp, inline: true },
              { name: 'Detalhes', value: JSON.stringify(data, null, 2).substring(0, 1000) }
            ]
          }]
        });
        console.log('✅ Alerta enviado para Discord');
      } catch (discordError) {
        console.error('❌ Erro ao enviar alerta para Discord:', discordError.message);
      }
    }
    
    // Enviar para email se configurado
    if (process.env.EMAIL_ALERTS_ENABLED === 'true' && process.env.EMAIL_ALERTS_TO) {
      try {
        // Aqui você pode integrar com seu serviço de email (SendGrid, AWS SES, etc)
        // Por agora, apenas logamos a intenção
        console.log(`📧 Alerta seria enviado para: ${process.env.EMAIL_ALERTS_TO}`);
      } catch (emailError) {
        console.error('❌ Erro ao enviar alerta por email:', emailError.message);
      }
    }

    // Retornar sucesso
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar alerta:', error);
    return false;
  }
}

/**
 * Envia alerta de erro
 * @param {string} message - Mensagem de alerta
 * @param {Object} data - Dados adicionais para o alerta
 */
export function sendErrorAlert(message, data = {}) {
  return sendAlert('error', message, data);
}

/**
 * Envia alerta de aviso
 * @param {string} message - Mensagem de alerta
 * @param {Object} data - Dados adicionais para o alerta
 */
export function sendWarningAlert(message, data = {}) {
  return sendAlert('warning', message, data);
}

/**
 * Envia alerta informativo
 * @param {string} message - Mensagem de alerta
 * @param {Object} data - Dados adicionais para o alerta
 */
export function sendInfoAlert(message, data = {}) {
  return sendAlert('info', message, data);
} 