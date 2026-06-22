'use client';

interface UserDisplayProps {
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  telegramId?: string;
}

export default function UserDisplay({ name, className = '', size = 'md', telegramId }: UserDisplayProps) {
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
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <span className={`${sizes.nick} text-slate-800 dark:text-slate-200`}>
        {nickname}
      </span>
      {firstName && (
        <span className={`${sizes.first} text-slate-400 dark:text-slate-500 font-normal`}>
          ({firstName})
        </span>
      )}
      {department && (
        <span className={`${sizes.dept} font-semibold uppercase tracking-wider rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50`}>
          {department}
        </span>
      )}
      {telegramId && (
        <a
          href={
            /^\d+$/.test(telegramId)
              ? `tg://user?id=${telegramId}`
              : `https://t.me/${telegramId.replace(/^@/, '')}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center text-[#229ED9] hover:text-[#1d8dbb] ml-0.5 transition-colors active:scale-90"
          title={`แชท Telegram กับ ${nickname}`}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.89 1.2-5.33 3.52-.5.35-.96.52-1.37.51-.45-.01-1.32-.26-1.97-.47-.8-.26-1.43-.4-1.37-.85.03-.23.35-.47.95-.71 3.71-1.61 6.19-2.67 7.44-3.18 3.53-1.44 4.26-1.69 4.74-1.7.1.01.35.03.5.16.13.11.17.26.19.37.02.13.02.26.01.39z"/>
          </svg>
        </a>
      )}
    </span>
  );
}
