/** In-memory pending loan offers keyed by user id (single server instance). */
const sessions = new Map();

function getLoanSession(userId) {
  return sessions.get(String(userId)) ?? null;
}

function setLoanSession(userId, session) {
  sessions.set(String(userId), {
    ...session,
    status: 'awaiting_loan_decision',
    createdAt: Date.now(),
  });
}

function clearLoanSession(userId) {
  sessions.delete(String(userId));
}

function clearAllLoanSessions() {
  sessions.clear();
}

module.exports = {
  getLoanSession,
  setLoanSession,
  clearLoanSession,
  clearAllLoanSessions,
};
