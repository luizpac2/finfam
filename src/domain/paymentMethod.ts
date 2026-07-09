import type { PaymentMethod } from '../lib/database.types';
import { normalizeText } from './categorizationEngine';

/**
 * Inferência da forma de pagamento a partir da descrição do lançamento.
 *
 * Heurística por palavra-chave, usada na importação de extratos (bancos usam
 * termos razoavelmente padronizados no histórico). No modo "extrato de cartão"
 * o método já é sabido (`credit_card`) e esta função nem é chamada.
 *
 * Retorna `null` quando nada casa — melhor deixar em branco do que chutar.
 */
export const inferPaymentMethod = (description: string): PaymentMethod | null => {
  const text = normalizeText(description);

  // Pix — inclui devolução/estorno de Pix.
  if (/\bpix\b/.test(text)) return 'pix';

  // Boleto / título / cobrança registrada.
  if (/\bboleto\b|\btitulo\b|pagamento de titulo|pagto? titulo/.test(text))
    return 'boleto';

  // TED / DOC / transferências entre bancos.
  if (/\bted\b|\bdoc\b|transf(erencia)?|transferencia/.test(text)) return 'ted';

  // Dinheiro — saques em espécie.
  if (/\bsaque\b|dinheiro|especie|caixa eletronico|saque \d/.test(text))
    return 'cash';

  // Cartão de débito (compra na função débito).
  if (/debito|deb\b|cartao de debito|compra deb/.test(text)) return 'debit_card';

  // Compra no crédito citada no próprio histórico do extrato do banco.
  if (/credito|cartao de credito|compra cartao/.test(text)) return 'credit_card';

  return null;
};
