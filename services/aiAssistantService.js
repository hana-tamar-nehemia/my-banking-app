const {
  getUserBalance,
  getRecentTransactions,
  transferMoney,
} = require('./bankingOperations');

const SYSTEM_PROMPT = `You are a secure, professional AI banking assistant for a single authenticated customer.

SECURITY RULES (never break these):
- You only have access to the currently logged-in user's account. Their identity is fixed by the server; never ask for or use a user ID.
- NEVER invent, guess, or estimate balances, transactions, or account details. Always call the appropriate tool first.
- NEVER claim you accessed another person's account.
- If a tool returns an error, explain it clearly and do not fabricate success.
- For money transfers, confirm the recipient email and amount with the user before calling transfer_money unless they already stated both clearly in the same request.
- When describing transactions, always use counterpartyEmail, summary, and type (sent/received). Never show raw MongoDB user IDs to the customer.

CAPABILITIES:
- get_user_balance: current balance
- get_recent_transactions: recent activity
- transfer_money: send money to another user by email

Be concise, friendly, and accurate. Format currency as USD with two decimal places.`;

let langChainModulesPromise = null;

async function loadLangChainModules() {
  if (!langChainModulesPromise) {
    langChainModulesPromise = Promise.all([
      import('@langchain/google-genai'),
      import('@langchain/core/tools'),
      import('@langchain/core/messages'),
      import('@langchain/langgraph/prebuilt'),
      import('zod'),
    ]).then(([googleGenai, tools, messages, prebuilt, zod]) => ({
      ChatGoogleGenerativeAI: googleGenai.ChatGoogleGenerativeAI,
      tool: tools.tool,
      HumanMessage: messages.HumanMessage,
      AIMessage: messages.AIMessage,
      SystemMessage: messages.SystemMessage,
      createReactAgent: prebuilt.createReactAgent,
      z: zod.z,
    }));
  }
  return langChainModulesPromise;
}

function historyToMessages(history, { HumanMessage, AIMessage }) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((entry) => entry?.content?.trim())
    .map((entry) => {
      const content = String(entry.content).trim();
      if (entry.role === 'assistant') {
        return new AIMessage(content);
      }
      return new HumanMessage(content);
    });
}

function buildTools(userId, io, { tool, z }) {
  let transferCompleted = false;

  const getBalance = tool(
    async () => {
      const data = await getUserBalance(userId);
      return JSON.stringify({
        balance: data.balance,
        currency: 'USD',
        email: data.email,
        username: data.username,
      });
    },
    {
      name: 'get_user_balance',
      description:
        'Fetch the authenticated user\'s current account balance. Call this whenever the user asks about their balance.',
      schema: z.object({}),
    }
  );

  const getTransactions = tool(
    async () => {
      const transactions = await getRecentTransactions(userId, 10, {
        withParties: true,
      });
      return JSON.stringify({ transactions });
    },
    {
      name: 'get_recent_transactions',
      description:
        'Fetch the authenticated user\'s recent transactions (up to 10). Call this for history or activity questions.',
      schema: z.object({}),
    }
  );

  const transfer = tool(
    async ({ receiverEmail, amount }) => {
      try {
        const result = await transferMoney(userId, receiverEmail, amount, io);
        transferCompleted = true;
        return JSON.stringify({
          success: true,
          message: result.message,
          newBalance: result.newBalance,
          transaction: result.transaction,
        });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: err.message || 'Transfer failed',
        });
      }
    },
    {
      name: 'transfer_money',
      description:
        'Transfer money from the authenticated user to another account by recipient email. Amount must be positive.',
      schema: z.object({
        receiverEmail: z
          .string()
          .describe('Recipient email address'),
        amount: z
          .number()
          .describe('Amount in USD to send (must be greater than 0)'),
      }),
    }
  );

  return {
    tools: [getBalance, getTransactions, transfer],
    wasTransferCompleted: () => transferCompleted,
  };
}

function formatAssistantError(err) {
  const msg = err?.message || String(err);
  if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
    return {
      status: 429,
      message:
        'מכסת Gemini החינמית נגמרה זמנית. המתיני כדקה ונסי שוב, או הגדירי GEMINI_MODEL=gemini-2.5-flash-lite ב-Render/.env. אפשר גם לבדוק מכסה ב-Google AI Studio.',
    };
  }
  if (msg.includes('404') && msg.includes('models/')) {
    return {
      status: 503,
      message:
        'מודל Gemini לא זמין. עדכני GEMINI_MODEL ל-gemini-2.5-flash-lite או gemini-2.0-flash.',
    };
  }
  if (msg.includes('GOOGLE_API_KEY')) {
    return { status: 503, message: msg };
  }
  return { status: 500, message: 'העוזר לא זמין כרגע. נסי שוב בעוד רגע.' };
}

/**
 * Run the LangGraph ReAct agent for one user message.
 * @param {{ userId: string, message: string, history?: Array, io?: object }} params
 */
async function runBankingAssistant({ userId, message, history = [], io = null }) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not configured on the server');
  }

  const trimmedMessage = message?.trim();
  if (!trimmedMessage) {
    throw new Error('Message is required');
  }

  const {
    ChatGoogleGenerativeAI,
    tool,
    HumanMessage,
    AIMessage,
    SystemMessage,
    createReactAgent,
    z,
  } = await loadLangChainModules();

  const { tools, wasTransferCompleted } = buildTools(userId, io, { tool, z });

  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    temperature: 0,
    apiKey: process.env.GOOGLE_API_KEY,
  });

  const agent = createReactAgent({
    llm,
    tools,
  });

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...historyToMessages(history, { HumanMessage, AIMessage }).slice(-10),
    new HumanMessage(trimmedMessage),
  ];

  let result;
  try {
    result = await agent.invoke({ messages }, { recursionLimit: 12 });
  } catch (err) {
    const formatted = formatAssistantError(err);
    const error = new Error(formatted.message);
    error.status = formatted.status;
    throw error;
  }

  const lastMessage = result.messages[result.messages.length - 1];
  const reply =
    typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : Array.isArray(lastMessage?.content)
        ? lastMessage.content
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n')
        : 'I could not generate a response. Please try again.';

  return {
    reply,
    refreshDashboard: wasTransferCompleted(),
  };
}

module.exports = {
  runBankingAssistant,
  SYSTEM_PROMPT,
};
