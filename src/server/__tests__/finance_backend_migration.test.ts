import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { generateToken, hashPassword } from '../auth';
import { userRepository, transactionRepository, budgetRepository } from '../repositories';
import { buildServerAuthorizedAIContext } from '../ai-context';
import { safeStorage } from '../../lib/storage';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiRouter);

describe('Finance Backend Authoritative Migration Suite', () => {
  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };

  beforeEach(async () => {
    resetRateLimitsForTesting();
    safeStorage.clear();

    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const passwordHash = hashPassword('FinancePass123!');

    const recordA = await userRepository.create({
      id: `usr_fin_a_${timestamp}`,
      email: `fina_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Finance Operator Alice',
        headline: 'CFO & Capital Allocator',
        bio: '',
        primaryLifeFocus: 'Wealth & Asset Allocation',
      },
      preferences: {
        theme: 'dark',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: false, dailyDigest: false },
      },
      subscription: {
        tier: 'pro',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const recordB = await userRepository.create({
      id: `usr_fin_b_${timestamp}`,
      email: `finb_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Finance Operator Bob',
        headline: 'Analyst',
        bio: '',
        primaryLifeFocus: 'Early Stage Investing',
      },
      preferences: {
        theme: 'light',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: false, dailyDigest: false },
      },
      subscription: {
        tier: 'pro',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    userA = {
      id: recordA.id,
      token: generateToken(recordA),
      email: recordA.email,
    };

    userB = {
      id: recordB.id,
      token: generateToken(recordB),
      email: recordB.email,
    };
  });

  it('creates, retrieves, and filters transactions with authenticated backend persistence', async () => {
    // 1. Create income transaction for User A
    const incomeRes = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Executive Consulting Retainer',
        description: 'Monthly advisory retainer',
        amount: 8500.0,
        amountMinorUnits: 850000,
        type: 'income',
        category: 'income_salary',
        date: '2026-08-01',
        currency: 'USD',
        tags: ['consulting', 'advisory'],
      });

    expect(incomeRes.status).toBe(200);
    expect(incomeRes.body.success).toBe(true);
    const createdIncome = incomeRes.body.data;
    expect(createdIncome.id).toBeDefined();
    expect(createdIncome.userId).toBe(userA.id);
    expect(createdIncome.amountMinorUnits).toBe(850000);
    expect(createdIncome.amount).toBe(8500.0);

    // 2. Create expense transaction for User A
    const expenseRes = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Cloud Infrastructure Servers',
        description: 'GPU cluster hosting',
        amount: 1200.5,
        type: 'expense',
        category: 'utilities',
        date: '2026-08-05',
        currency: 'USD',
        merchantOrSource: 'Cloud Compute Inc',
      });

    expect(expenseRes.status).toBe(200);
    expect(expenseRes.body.success).toBe(true);
    const createdExpense = expenseRes.body.data;
    expect(createdExpense.amountMinorUnits).toBe(120050);
    expect(createdExpense.amount).toBe(1200.5);

    // 3. List transactions with month filter
    const listRes = await request(app)
      .get('/api/finances/transactions?month=2026-08')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(2);

    // 4. Filter by type
    const expenseListRes = await request(app)
      .get('/api/finances/transactions?type=expense')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(expenseListRes.status).toBe(200);
    expect(expenseListRes.body.data.length).toBe(1);
    expect(expenseListRes.body.data[0].category).toBe('utilities');

    // 5. Search transactions
    const searchRes = await request(app)
      .get('/api/finances/transactions?search=GPU')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.data[0].id).toBe(createdExpense.id);

    // 6. Direct lookup by ID
    const singleRes = await request(app)
      .get(`/api/finances/transactions/${createdIncome.id}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(singleRes.status).toBe(200);
    expect(singleRes.body.data.title).toBe('Executive Consulting Retainer');
  });

  it('updates and deletes transactions while validating database mutation', async () => {
    const createRes = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Draft Transaction',
        amount: 250.0,
        type: 'expense',
        category: 'other',
        date: '2026-08-10',
      });

    const txId = createRes.body.data.id;

    // Update transaction
    const updateRes = await request(app)
      .put(`/api/finances/transactions/${txId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Confirmed SaaS Subscription',
        amount: 300.0,
        category: 'utilities',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.title).toBe('Confirmed SaaS Subscription');
    expect(updateRes.body.data.amount).toBe(300.0);
    expect(updateRes.body.data.amountMinorUnits).toBe(30000);

    // Delete transaction
    const deleteRes = await request(app)
      .delete(`/api/finances/transactions/${txId}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify deleted in DB
    const getRes = await request(app)
      .get(`/api/finances/transactions/${txId}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(getRes.status).toBe(404);
  });

  it('manages budgets in the backend repository and enforces monthly limits', async () => {
    // 1. Create budget
    const createRes = await request(app)
      .post('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        category: 'dining_out',
        amount: 600.0,
        period: 'monthly',
        monthYear: '2026-08',
        alertThresholdPercentage: 85,
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    const createdBudget = createRes.body.data;
    expect(createdBudget.id).toBeDefined();
    expect(createdBudget.category).toBe('dining_out');
    expect(createdBudget.amount).toBe(600.0);
    expect(createdBudget.amountMinorUnits).toBe(60000);

    // 2. Read budgets
    const listRes = await request(app)
      .get('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(createdBudget.id);

    // 3. Update budget
    const updateRes = await request(app)
      .put(`/api/finances/budgets/${createdBudget.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        amount: 750.0,
        alertThresholdPercentage: 90,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.amount).toBe(750.0);
    expect(updateRes.body.data.amountMinorUnits).toBe(75000);

    // 4. Delete budget
    const delRes = await request(app)
      .delete(`/api/finances/budgets/${createdBudget.id}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(delRes.status).toBe(200);

    // Verify gone
    const listAfterDel = await request(app)
      .get('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(listAfterDel.body.data.length).toBe(0);
  });

  it('enforces strict multi-tenant isolation and rejects cross-user access', async () => {
    // User A creates a confidential financial transaction
    const txResA = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Secret Angel Investment',
        amount: 50000.0,
        type: 'expense',
        category: 'savings_investments',
        date: '2026-08-01',
      });
    const txIdA = txResA.body.data.id;

    // User A creates a budget
    const bResA = await request(app)
      .post('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        category: 'savings_investments',
        amount: 100000.0,
      });
    const budgetIdA = bResA.body.data.id;

    // User B attempts to read User A's transaction
    const breachTx = await request(app)
      .get(`/api/finances/transactions/${txIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(breachTx.status).toBe(404);

    // User B attempts to update User A's transaction
    const breachUpdate = await request(app)
      .put(`/api/finances/transactions/${txIdA}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Hacked by User B' });
    expect(breachUpdate.status).toBe(404);

    // User B attempts to delete User A's transaction
    const breachDel = await request(app)
      .delete(`/api/finances/transactions/${txIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(breachDel.status).toBe(404);

    // User B attempts to read User A's budget
    const breachBudget = await request(app)
      .get(`/api/finances/budgets/${budgetIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(breachBudget.status).toBe(404);

    // User B attempts to delete User A's budget
    const breachDelB = await request(app)
      .delete(`/api/finances/budgets/${budgetIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(breachDelB.status).toBe(404);

    // Verify User A's data was completely unharmed
    const verifyTxA = await request(app)
      .get(`/api/finances/transactions/${txIdA}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(verifyTxA.body.data.title).toBe('Secret Angel Investment');

    // Reject forged client-supplied userId in creation payload
    const forgedRes = await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        userId: userA.id, // Attempt to inject record into User A's account
        title: 'Forged Transaction',
        amount: 999.0,
        type: 'expense',
        category: 'other',
        date: '2026-08-02',
      });
    expect(forgedRes.status).toBe(200);
    expect(forgedRes.body.data.userId).toBe(userB.id); // Must be bound to authenticated User B
  });

  it('ensures financial data persists across page refreshes and clearing of localStorage', async () => {
    // 1. User A creates a transaction and budget in the backend
    await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Annual Enterprise Retainer',
        amount: 24000.0,
        type: 'income',
        category: 'income_salary',
        date: '2026-08-01',
      });

    await request(app)
      .post('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        category: 'education_learning',
        amount: 3000.0,
      });

    // 2. Simulate browser cache / localStorage wiped entirely
    safeStorage.clear();

    // 3. User A queries backend again
    const txList = await request(app)
      .get('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(txList.status).toBe(200);
    expect(txList.body.data.length).toBe(1);
    expect(txList.body.data[0].title).toBe('Annual Enterprise Retainer');
    expect(txList.body.data[0].amount).toBe(24000.0);

    const budgetList = await request(app)
      .get('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`);

    expect(budgetList.status).toBe(200);
    expect(budgetList.body.data.length).toBe(1);
    expect(budgetList.body.data[0].category).toBe('education_learning');
  });

  it('guarantees server-side AI context includes authoritative transactions and budgets', async () => {
    // Create financial data on backend for User A
    await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Quarterly Dividends',
        amount: 4500.0,
        type: 'income',
        category: 'savings_investments',
        date: '2026-08-01',
      });

    await request(app)
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Datacenter Colocation',
        amount: 1500.0,
        type: 'expense',
        category: 'utilities',
        date: '2026-08-02',
      });

    await request(app)
      .post('/api/finances/budgets')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        category: 'utilities',
        amount: 2000.0,
      });

    // Build authorized AI context on server for User A
    const aiContextA = buildServerAuthorizedAIContext(userA.id);
    expect(aiContextA.finances).toBeDefined();
    expect(aiContextA.finances.monthlyIncome).toBe(4500.0);
    expect(aiContextA.finances.monthlyExpenses).toBe(1500.0);
    expect(aiContextA.finances.recentTransactions.length).toBeGreaterThanOrEqual(2);
    const divTx = aiContextA.finances.recentTransactions.find((t) => t.title === 'Quarterly Dividends');
    expect(divTx).toBeDefined();
    expect(divTx?.amount).toBe(4500.0);

    const budgetItem = aiContextA.finances.budgets.find((b) => b.category === 'utilities');
    expect(budgetItem).toBeDefined();
    expect(budgetItem?.limitAmount).toBe(2000.0);

    // Check User B's AI context has NO User A financial data
    const aiContextB = buildServerAuthorizedAIContext(userB.id);
    expect(aiContextB.finances.monthlyIncome).toBe(0);
    expect(aiContextB.finances.monthlyExpenses).toBe(0);
    expect(aiContextB.finances.recentTransactions.length).toBe(0);
  });
});
