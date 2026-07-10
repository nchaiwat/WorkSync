'use client';

interface UserDisplayProps {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  telegramId?: string;
  noDeptBadge?: boolean;
}

export default function UserDisplay({ name, className = '', size = 'md', telegramId, noDeptBadge = false }: UserDisplayProps) {
  if (!name) return <span className={`text-gray-400 dark:text-slate-500 ${className}`}>-</span>;

  // Regular expression to parse: "Nickname (FirstName)/Department"
  // Format example: Oat (Chaiwat)/IT or Oat(Chaiwat)/IT
  const match = name.match(/^([^\s(]+)\s*(?:\(([^)]+)\))?\s*(?:\/([^\s]+))?$/);

  if (!match) {
    return <span className={`font-medium text-gray-900 dark:text-gray-100 ${className}`}>{name}</span>;
  }

  const [_, nickname, firstName, department] = match;
  
  const textSizes = {
    sm: {
      nick: 'text-xs font-semibold',
      first: 'text-[10px]',
      dept: 'text-[9px] px-1 py-0.2'
    },
    md: {
      nick: 'text-sm font-bold',
      first: 'text-xs',
      dept: 'text-[10px] px-1.5 py-0.5'
    },
    lg: {
      nick: 'text-base font-extrabold',
      first: 'text-sm',
      dept: 'text-xs px-2 py-1'
    }
  };

  const sizes = textSizes[size];

  return (
    <span className={`inline-flex items-center justify-center gap-1.5 flex-wrap ${className}`}>
      <span className={`${sizes.nick} text-slate-800 dark:text-slate-200`}>
        {nickname}
      </span>
      {firstName && (
        <span className={`${sizes.first} text-slate-400 dark:text-slate-500 font-normal`}>
          ({firstName})
        </span>
      )}
      {department && (
        noDeptBadge ? (
          <span className={`${sizes.first} text-slate-400 dark:text-slate-500 font-normal ml-1`}>
            / {department}
          </span>
        ) : (
          <span className={`${sizes.dept} font-semibold uppercase tracking-wider rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50`}>
            {department}
          </span>
        )
      )}
    </span>
  );
}
