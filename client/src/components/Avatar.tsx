import * as Primitive from '@radix-ui/react-avatar';
import { Skeleton } from './Skeleton';

export function Avatar({ name, src, loading = false, variant = 'user', size = 'sm' }: {
  name: string; src?: string; loading?: boolean;
  variant?: 'user' | 'character'; size?: 'sm' | 'md' | 'lg';
}) {
  const initials = name.trim().split(/\s+/u).filter(Boolean).map(part => [...part][0]);
  const className = `qf-avatar qf-avatar--${variant} qf-avatar--${size}`;
  if (loading) return <span className={className}><Skeleton shape="avatar" label={`Carregando avatar de ${name}`} /></span>;
  return <Primitive.Root className={className}>
    <Primitive.Image src={src} alt={name} className="qf-avatar__image" />
    <Primitive.Fallback className="qf-avatar__fallback" role="img" aria-label={name}>
      {(initials.length > 1 ? [initials[0], initials.at(-1)] : initials).join('').toLocaleUpperCase('pt-BR') || '?'}
    </Primitive.Fallback>
  </Primitive.Root>;
}
