import { useId, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { Button } from './Button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function CopyField({ value, label = 'Código de convite', copy = text => navigator.clipboard.writeText(text) }: {
  value: string; label?: string; copy?: (value: string) => Promise<void>;
}) {
  const id = useId();
  const [feedback, setFeedback] = useState<{ value: string; state: 'copying' | 'copied' | 'error' }>();
  const state = feedback?.value === value ? feedback.state : undefined;
  async function copyValue() {
    setFeedback({ value, state: 'copying' });
    try {
      await copy(value);
      setFeedback(current => current?.value === value ? { value, state: 'copied' } : current);
    } catch {
      setFeedback(current => current?.value === value ? { value, state: 'error' } : current);
    }
  }
  return <div className="grid min-w-0 gap-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-wrap gap-2">
      <Input className="w-0 flex-[1_1_120px] font-mono font-semibold tracking-[0.16em] tabular-nums" id={id} value={value} readOnly onFocus={event => event.currentTarget.select()} aria-describedby={`${id}-status`} />
      <Button variant="secondary" onClick={copyValue} loading={state === 'copying'}>
        {state === 'copied' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {state === 'copied' ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
    <p id={`${id}-status`} role="status" className={cn('text-small', state === 'error' ? 'text-danger-text' : 'text-text-muted')}>
      {state === 'error' ? 'Não foi possível copiar. Selecione o código e copie manualmente.'
        : state === 'copied' ? 'Código copiado. Compartilhe com sua mesa.' : 'Compartilhe este código para convidar alguém.'}
    </p>
  </div>;
}
