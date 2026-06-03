/**
 * Build unique quick-transfer contacts from transaction history.
 */
export function extractContactsFromTransactions(transactions, currentUserId, currentEmail) {
  if (!transactions?.length || !currentUserId) return [];

  const normalizedSelf = currentEmail?.trim().toLowerCase();
  const map = new Map();

  for (const tx of transactions) {
    const email = tx.counterpartyEmail;
    const username = tx.counterpartyUsername;

    if (!email) continue;
    const key = email.trim().toLowerCase();
    if (normalizedSelf && key === normalizedSelf) continue;
    if (map.has(key)) continue;

    map.set(key, {
      email: key,
      username: username || email.split('@')[0],
      displayName: getFirstName(username || email),
      initials: getInitials(username || email),
    });
  }

  return Array.from(map.values());
}

function getFirstName(usernameOrEmail) {
  const raw = usernameOrEmail.includes('@')
    ? usernameOrEmail.split('@')[0]
    : usernameOrEmail;
  const parts = raw.replace(/[._-]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function getInitials(usernameOrEmail) {
  const raw = usernameOrEmail.includes('@')
    ? usernameOrEmail.split('@')[0]
    : usernameOrEmail;
  const parts = raw.replace(/[._-]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const p = parts[0] || 'U';
  return p.length >= 2 ? p.slice(0, 2).toUpperCase() : (p[0] + p[0]).toUpperCase();
}
