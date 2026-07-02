import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface DragAndDropZoneProps {
  /** Chamado com o arquivo selecionado (via drop ou seleção manual). */
  onFileSelected: (file: File) => void;
  /** Tipos aceitos no seletor de arquivos. */
  accept?: string;
  disabled?: boolean;
  hint?: string;
}

const DEFAULT_ACCEPT = '.ofx,.ofc,.csv,.txt,.pdf';

/**
 * Área de upload com arrastar-e-soltar.
 * Ao passar um arquivo por cima (hover/drag), o fundo fica #F1F2CE (brand-cream).
 */
export function DragAndDropZone({
  onFileSelected,
  accept = DEFAULT_ACCEPT,
  disabled = false,
  hint,
}: DragAndDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  const pick = (files: FileList | null) => {
    if (disabled || !files || files.length === 0) return;
    onFileSelected(files[0]);
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);
    pick(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsOver(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={() => setIsOver(false)}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center outline-none transition',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        isOver
          ? 'border-brand-aqua bg-brand-cream'
          : 'border-brand-moss/30 bg-white hover:bg-brand-light focus-visible:border-brand-aqua',
      ].join(' ')}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
          isOver ? 'bg-white' : 'bg-brand-aqua/15'
        }`}
      >
        <UploadCloud className="h-6 w-6 text-brand-moss" strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-medium text-brand-moss">
          Arraste o extrato aqui
        </p>
        <p className="text-sm text-brand-gray">
          ou clique para selecionar · OFX, OFC, CSV, TXT ou PDF
        </p>
      </div>
      {hint && <p className="text-xs text-brand-gray">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = ''; // permite reenviar o mesmo arquivo
        }}
      />
    </div>
  );
}
