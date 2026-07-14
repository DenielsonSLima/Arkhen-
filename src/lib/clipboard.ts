/**
 * Copia um texto para a área de transferência do usuário.
 * Funciona tanto em contextos seguros (HTTPS/localhost) quanto em contextos inseguros (HTTP via IP).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Tentar usar a API moderna do Navigator Clipboard se estiver disponível
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[copyToClipboard] Falha ao usar navigator.clipboard. Usando fallback.', err);
    }
  }

  // 2. Fallback para navegadores sem a API Clipboard ou contextos não seguros (HTTP via IP)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Evitar scroll visual ao adicionar o elemento
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
    throw new Error('execCommand returned false');
  } catch (err) {
    console.error('[copyToClipboard] Falha ao copiar texto usando fallback:', err);
    return false;
  }
}
