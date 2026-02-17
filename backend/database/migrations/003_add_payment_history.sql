-- Add created_at to debt_records if missing
ALTER TABLE debt_records
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Payment history table (audit trail)
CREATE TABLE IF NOT EXISTS payment_history (
    payment_id SERIAL PRIMARY KEY,
    debt_id INTEGER NOT NULL REFERENCES debt_records(debt_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('CHAPA', 'RECEIPT', 'BANK_TRANSFER')),
    transaction_ref VARCHAR(255),
    status VARCHAR(50) DEFAULT 'SUCCESS' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by INTEGER REFERENCES users(user_id),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_history_debt_id ON payment_history(debt_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_date ON payment_history(payment_date DESC);
