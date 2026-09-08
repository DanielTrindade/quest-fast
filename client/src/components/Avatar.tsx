import * as Primitive from '@radix-ui/react-avatar';
import { Skeleton } from './Skeleton';

export function Avatar({ name, src, loading = false }: { name: string; src?: string; loading?: boolean }) {
  const initials = name.trim().split(/\s+/u).filter(Boolean).map(part => [...part][0]);
  if (loading) return <Skeleton shape="avatar" label={`Carregando avatar de ${name}`} />;
  return <Primitive.Root className="qf-avatar">
    <Primitive.Image src={src} alt={name} className="qf-avatar__image" />
    <Primitive.Fallback className="qf-avatar__fallback" role="img" aria-label={name}>
      {(initials.length > 1 ? [initials[0], initials.at(-1)] : initials).join('').toLocaleUpperCase('pt-BR') || '?'}
    </Primitive.Fallback>
  </Primitive.Root>;
}
