import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createSupplierSchema,
    updateSupplierSchema,
    createContractSchema,
} from '../../src/modules/supplier/supplier.validation.js';

const baseSupplier = {
    name: 'Big Bus London',
    countryId: 1,
    cityIds: [1, 2],
    bookingEmail: 'bookings@bigbus.example',
    currency: 'gbp',
};

test('createSupplierSchema accepts a minimal valid supplier', () => {
    const parsed = createSupplierSchema.parse(baseSupplier);
    assert.equal(parsed.currency, 'GBP', 'currency uppercased');
    assert.equal(parsed.paymentMode, 'POSTPAID', 'defaults to POSTPAID');
    assert.equal(parsed.hasApi, false);
    assert.equal(parsed.apiType, 'NONE');
    assert.equal(parsed.status, 'ACTIVE');
    assert.deepEqual(parsed.cityIds, [1, 2]);
});

test('createSupplierSchema rejects bad currency code length', () => {
    assert.throws(() =>
        createSupplierSchema.parse({ ...baseSupplier, currency: 'POUNDS' })
    );
});

test('createSupplierSchema rejects invalid bookingEmail', () => {
    assert.throws(() =>
        createSupplierSchema.parse({ ...baseSupplier, bookingEmail: 'not-an-email' })
    );
});

test('createSupplierSchema requires apiType+apiKey when hasApi=true', () => {
    assert.throws(
        () =>
            createSupplierSchema.parse({
                ...baseSupplier,
                hasApi: true,
                apiType: 'NONE',
            }),
        /API type is required/
    );

    assert.throws(
        () =>
            createSupplierSchema.parse({
                ...baseSupplier,
                hasApi: true,
                apiType: 'VENTRATA',
            }),
        /API key is required/
    );
});

test('createSupplierSchema requires apiChannelId when apiType=TOURCMS', () => {
    assert.throws(
        () =>
            createSupplierSchema.parse({
                ...baseSupplier,
                hasApi: true,
                apiType: 'TOURCMS',
                apiKey: 'k',
            }),
        /channel ID is required/
    );

    const ok = createSupplierSchema.parse({
        ...baseSupplier,
        hasApi: true,
        apiType: 'TOURCMS',
        apiKey: 'k',
        apiChannelId: '3930',
    });
    assert.equal(ok.apiChannelId, '3930');
});

test('createSupplierSchema accepts blank optional fields', () => {
    const parsed = createSupplierSchema.parse({
        ...baseSupplier,
        address: '',
        phone: '',
        bankIfsc: '',
        financeContactEmail: '',
    });
    assert.equal(parsed.address, null);
    assert.equal(parsed.phone, null);
    assert.equal(parsed.bankIfsc, null);
    assert.equal(parsed.financeContactEmail, null);
});

test('createSupplierSchema defaults cityIds to empty array', () => {
    const { cityIds: _omit, ...payload } = baseSupplier;
    const parsed = createSupplierSchema.parse(payload);
    assert.deepEqual(parsed.cityIds, []);
});

test('updateSupplierSchema allows partial updates (status only)', () => {
    const parsed = updateSupplierSchema.parse({ status: 'INACTIVE' });
    assert.equal(parsed.status, 'INACTIVE');
});

test('createContractSchema validates URL + label and date order', () => {
    const ok = createContractSchema.parse({
        type: 'CONTRACT',
        label: 'Master Contract 2026',
        fileUrl: 'https://r2.example/contracts/2026-master.pdf',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
    });
    assert.equal(ok.label, 'Master Contract 2026');

    assert.throws(() =>
        createContractSchema.parse({
            label: 'Bad',
            fileUrl: 'not-a-url',
        })
    );

    assert.throws(
        () =>
            createContractSchema.parse({
                label: 'Bad order',
                fileUrl: 'https://r2.example/x.pdf',
                validFrom: '2026-12-31',
                validTo: '2026-01-01',
            }),
        /validTo must be on or after validFrom/
    );
});

test('createContractSchema defaults type to RATE_SHEET', () => {
    const parsed = createContractSchema.parse({
        label: 'Rates Q1',
        fileUrl: 'https://r2.example/rates-q1.pdf',
    });
    assert.equal(parsed.type, 'RATE_SHEET');
});
