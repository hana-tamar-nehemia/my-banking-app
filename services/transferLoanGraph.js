const bankingOperations = require('./bankingOperations');
const { clearLoanSession } = require('./loanSessionStore');

let compiledGraphPromise = null;

const ACCEPT_PATTERNS = [
  /^yes\b/i,
  /^y\b/i,
  /^ok\b/i,
  /^sure\b/i,
  /^accept\b/i,
  /^approve\b/i,
  /^כן/,
  /^אישור/,
];

const REJECT_PATTERNS = [
  /^no\b/i,
  /^n\b/i,
  /^cancel\b/i,
  /^decline\b/i,
  /^reject\b/i,
  /^לא/,
  /^ביטול/,
];

function parseLoanDecision(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (ACCEPT_PATTERNS.some((pattern) => pattern.test(text))) return 'accept';
  if (REJECT_PATTERNS.some((pattern) => pattern.test(text))) return 'reject';
  return null;
}

async function rejectLoanFlow(userId) {
  clearLoanSession(userId);
  return {
    reply:
      'No problem — the loan was not applied and no transfer was made. Your account is unchanged.',
    refreshDashboard: false,
  };
}

async function acceptLoanFlow({ userId, session, io = null }) {
  await bankingOperations.issueLoan(userId, session.shortfall);
  const result = await bankingOperations.transferMoney(
    userId,
    session.receiverEmail,
    session.amount,
    io
  );
  clearLoanSession(userId);
  return {
    reply: `Your loan of $${session.shortfall.toFixed(2)} was approved and $${session.amount.toFixed(2)} was sent to ${session.receiverEmail}. Your new balance is $${result.newBalance.toFixed(2)}.`,
    refreshDashboard: true,
  };
}

async function buildTransferLoanGraph() {
  const { StateGraph, Annotation, END, START } = await import('@langchain/langgraph');

  const LoanState = Annotation.Root({
    userId: Annotation(),
    receiverEmail: Annotation(),
    amount: Annotation(),
    shortfall: Annotation(),
    decision: Annotation(),
    io: Annotation(),
    reply: Annotation(),
    refreshDashboard: Annotation({
      reducer: (_, next) => Boolean(next),
      default: () => false,
    }),
  });

  async function rejectLoan(state) {
    return rejectLoanFlow(state.userId);
  }

  async function grantLoan(state) {
    await bankingOperations.issueLoan(state.userId, state.shortfall);
    return {};
  }

  async function completeTransfer(state) {
    const result = await bankingOperations.transferMoney(
      state.userId,
      state.receiverEmail,
      state.amount,
      state.io
    );
    clearLoanSession(state.userId);
    return {
      reply: `Your loan of $${state.shortfall.toFixed(2)} was approved and $${state.amount.toFixed(2)} was sent to ${state.receiverEmail}. Your new balance is $${result.newBalance.toFixed(2)}.`,
      refreshDashboard: true,
    };
  }

  function routeDecision(state) {
    return state.decision === 'accept' ? 'grant_loan' : 'reject_loan';
  }

  const graph = new StateGraph(LoanState)
    .addNode('reject_loan', rejectLoan)
    .addNode('grant_loan', grantLoan)
    .addNode('complete_transfer', completeTransfer)
    .addConditionalEdges(START, routeDecision, {
      grant_loan: 'grant_loan',
      reject_loan: 'reject_loan',
    })
    .addEdge('grant_loan', 'complete_transfer')
    .addEdge('reject_loan', END)
    .addEdge('complete_transfer', END);

  return graph.compile();
}

async function getCompiledGraph() {
  if (!compiledGraphPromise) {
    compiledGraphPromise = buildTransferLoanGraph();
  }
  return compiledGraphPromise;
}

/**
 * Run the LangGraph loan decision workflow.
 * Accept: grant loan → transfer. Reject: clear session, no DB changes.
 */
async function runTransferLoanGraph({ userId, session, decision, io = null }) {
  const graph = await getCompiledGraph();
  const result = await graph.invoke({
    userId,
    receiverEmail: session.receiverEmail,
    amount: session.amount,
    shortfall: session.shortfall,
    decision,
    io,
  });

  return {
    reply: result.reply,
    refreshDashboard: result.refreshDashboard,
  };
}

function resetTransferLoanGraph() {
  compiledGraphPromise = null;
}

module.exports = {
  parseLoanDecision,
  rejectLoanFlow,
  acceptLoanFlow,
  runTransferLoanGraph,
  resetTransferLoanGraph,
};
