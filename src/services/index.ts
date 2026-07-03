/**
 * Ponto único de exportação da camada de serviços (data access).
 * Permite importações limpas: `import { transactionService } from '@/services'`.
 */
export { authService } from './authService';
export { userService } from './userService';
export { categoryService } from './categoryService';
export { categoryRuleService } from './categoryRuleService';
export { transactionService } from './transactionService';
export { ServiceError } from './serviceError';
