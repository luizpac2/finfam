import { useContext } from 'react';

import {
  ReferenceDataContext,
  type ReferenceDataValue,
} from '../context/ReferenceDataContext';

/**
 * Acessa o cache compartilhado de categorias e regras.
 * Falha cedo se usado fora do `ReferenceDataProvider`.
 */
export function useReferenceData(): ReferenceDataValue {
  const context = useContext(ReferenceDataContext);
  if (context === null) {
    throw new Error(
      'useReferenceData deve ser usado dentro de um <ReferenceDataProvider>.'
    );
  }
  return context;
}
