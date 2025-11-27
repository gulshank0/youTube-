-- Update BankAccountType enum from (CHECKING, SAVINGS) to (SAVING, CURRENT)

-- Step 1: Add new enum values
ALTER TYPE "BankAccountType" ADD VALUE IF NOT EXISTS 'SAVING';
ALTER TYPE "BankAccountType" ADD VALUE IF NOT EXISTS 'CURRENT';
