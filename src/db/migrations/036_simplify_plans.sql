-- 036_simplify_plans.sql
-- Remove Scale and Business plans; Pro now includes all features.

-- 1. Move existing subscriptions on 'scale' or 'business' to 'pro'
UPDATE business_subscriptions
  SET plan_id = (SELECT id FROM plans WHERE code = 'pro')
  WHERE plan_id IN (SELECT id FROM plans WHERE code IN ('scale', 'business'));

-- 2. Delete the Scale and Business plans
DELETE FROM plans WHERE code IN ('scale', 'business');

-- 3. Create a new enum type without 'scale' and 'business'
DROP TYPE IF EXISTS subscription_plan_new CASCADE;
CREATE TYPE subscription_plan_new AS ENUM ('free', 'pro');

-- 4. Recreate columns and tables using the new type
ALTER TABLE plans ALTER COLUMN code TYPE subscription_plan_new
  USING code::text::subscription_plan_new;
ALTER TABLE feature_flags ALTER COLUMN requires_plan TYPE subscription_plan_new
  USING requires_plan::text::subscription_plan_new;
ALTER TABLE subscription_events ALTER COLUMN from_plan TYPE subscription_plan_new
  USING from_plan::text::subscription_plan_new;
ALTER TABLE subscription_events ALTER COLUMN to_plan TYPE subscription_plan_new
  USING to_plan::text::subscription_plan_new;

-- 5. Drop the old enum type and rename the new one
DROP TYPE subscription_plan CASCADE;
ALTER TYPE subscription_plan_new RENAME TO subscription_plan;

-- 6. Update the plans table to add pro price (was 19, now includes everything)
UPDATE plans SET name = 'Pro', description = 'All features. Billed monthly.', price_monthly = 19 WHERE code = 'pro';

-- 7. Clean up any feature flags that referenced deleted plans (shouldn't exist after step 1-4, but be safe)
UPDATE feature_flags SET requires_plan = 'pro' WHERE requires_plan IS NULL AND is_premium = true;
