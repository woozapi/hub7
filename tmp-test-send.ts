import { waManager } from './src/services/whatsappManager';

async function main() {
  const instanceId = 'e66782d8-e5f5-4ca5-ae91-ce12349afc03';
  const targetJid = '5548991138937@s.whatsapp.net';
  const message = 'Teste de envio automático - Fluow AI - ' + new Date().toLocaleString();

  console.log(`Sending message to ${targetJid} from instance ${instanceId}...`);
  try {
    // Note: This script needs to be run in a way that it can access the same memory if possible, 
    // but waManager is a singleton in each process. 
    // Since I can't easily join the main process, I'll just check the logs after the user reacts.
    // OR I can add a temporary route to server.ts that triggers this.
  } catch (err) {
    console.error('Error:', err);
  }
}
