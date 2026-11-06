import { formatUserDisplayName } from './auth';

/**
 * Checks if two name strings refer to the same person,
 * handling variations like "Sense", "Sense (Thanaphat)", "Sense (Thanaphat)/IT", etc.
 */
export function isSamePerson(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const a = nameA.trim().toLowerCase();
  const b = nameB.trim().toLowerCase();
  if (a === b) return true;

  const extractTokens = (str: string): Set<string> => {
    const tokens = new Set<string>();
    
    // Nickname before first space, parenthesis, or slash
    const nick = str.match(/^([^\s(/]+)/)?.[1]?.toLowerCase();
    if (nick && nick.length > 0) tokens.add(nick);

    // Name inside parentheses e.g. (Thanaphat)
    const paren = str.match(/\(([^)]+)\)/)?.[1]?.toLowerCase();
    if (paren && paren.length > 0) tokens.add(paren);

    // Any word tokens excluding short noise/dept words
    const noise = new Set(['it', 'hr', 'acc', 'mkt', 'sales', 'admin', 'system']);
    str.replace(/[()\/,-]/g, ' ').split(/\s+/).forEach(t => {
      const clean = t.trim().toLowerCase();
      if (clean.length > 1 && !noise.has(clean)) {
        tokens.add(clean);
      }
    });

    return tokens;
  };

  const tokensA = extractTokens(a);
  const tokensB = extractTokens(b);

  for (const token of tokensA) {
    if (tokensB.has(token)) return true;
  }

  return false;
}

/**
 * Checks if a task field (created_by_name, assignee, manager, collaborator)
 * matches the current user.
 */
export function isCurrentUserMatch(taskField: string | null | undefined, currentUser: any): boolean {
  if (!taskField || !currentUser) return false;
  const tf = taskField.trim();
  
  if (currentUser.id && tf === currentUser.id) return true;

  const formattedName = formatUserDisplayName(currentUser);
  if (isSamePerson(tf, formattedName)) return true;

  if (currentUser.first_name && isSamePerson(tf, currentUser.first_name)) return true;
  if (currentUser.username && isSamePerson(tf, currentUser.username)) return true;
  if (currentUser.nickname && isSamePerson(tf, currentUser.nickname)) return true;

  return false;
}
