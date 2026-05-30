import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerSchema } from '../../src/modules/customer/customer.validation.js';
import { createAgentSchema } from '../../src/modules/agent/agent.validation.js';

test('createCustomerSchema accepts valid input', () => {
    const parsed = createCustomerSchema.parse({ name: 'John Smith', email: 'john@example.com' });
    assert.equal(parsed.email, 'john@example.com');
    assert.equal(parsed.status, 'ACTIVE');
});

test('createCustomerSchema rejects bad email', () => {
    assert.throws(() => createCustomerSchema.parse({ name: 'John', email: 'nope' }));
});

test('createAgentSchema defaults to PENDING approval', () => {
    const parsed = createAgentSchema.parse({ name: 'Travel Co', email: 'agent@example.com' });
    assert.equal(parsed.agentStatus, 'PENDING');
});

test('createAgentSchema rejects commissionPercent outside [-100, 100]', () => {
    assert.throws(() =>
        createAgentSchema.parse({ name: 'X', email: 'x@example.com', commissionPercent: 150 })
    );
});
