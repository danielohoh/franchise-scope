-- 005_test.sql — 마이그레이션 005 검증 (Supabase SQL Editor에서 수동 실행)
-- This file verifies that migration 005 ran correctly
-- Run this in Supabase SQL Editor to validate the migration

-- ============================================================================
-- 1. Verify all 8 expected tables exist
-- ============================================================================
DO $$
DECLARE
  v_table_count INT;
  v_missing_tables TEXT;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'users',
      'brands',
      'disclosures',
      'disclosure_parsed_data',
      'analyses',
      'analysis_collected_data',
      'analysis_reports',
      'public_data_cache'
    );

  IF v_table_count = 8 THEN
    RAISE NOTICE '✓ All 8 expected tables exist';
  ELSE
    RAISE EXCEPTION '✗ Expected 8 tables, found %', v_table_count;
  END IF;
END $$;

-- ============================================================================
-- 2. Verify brands table has all v2.0 columns
-- ============================================================================
DO $$
DECLARE
  v_column_count INT;
  v_expected_columns TEXT[] := ARRAY[
    'company_name',
    'representative',
    'business_number',
    'address',
    'phone',
    'category',
    'price_tier',
    'royalty_type',
    'royalty_amount',
    'standard_size_min',
    'standard_size_max',
    'standard_staff_count',
    'territory_protection_meters',
    'contract_period_years'
  ];
BEGIN
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'brands'
    AND column_name = ANY(v_expected_columns);

  IF v_column_count = 14 THEN
    RAISE NOTICE '✓ All 14 v2.0 columns exist in brands table';
  ELSE
    RAISE EXCEPTION '✗ Expected 14 v2.0 columns in brands table, found %', v_column_count;
  END IF;
END $$;

-- ============================================================================
-- 3. Verify RLS is enabled on all new tables
-- ============================================================================
DO $$
DECLARE
  v_rls_count INT;
  v_expected_rls_tables TEXT[] := ARRAY[
    'brands',
    'disclosures',
    'disclosure_parsed_data',
    'analyses',
    'analysis_collected_data',
    'analysis_reports',
    'public_data_cache'
  ];
BEGIN
  SELECT COUNT(*) INTO v_rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY(v_expected_rls_tables)
    AND rowsecurity = true;

  IF v_rls_count = 7 THEN
    RAISE NOTICE '✓ RLS is enabled on all 7 new tables';
  ELSE
    RAISE EXCEPTION '✗ Expected RLS on 7 tables, found % with RLS enabled', v_rls_count;
  END IF;
END $$;

-- ============================================================================
-- 4. Verify storage buckets exist
-- ============================================================================
DO $$
DECLARE
  v_bucket_count INT;
BEGIN
  SELECT COUNT(*) INTO v_bucket_count
  FROM storage.buckets
  WHERE name IN ('disclosures', 'reports', 'logos');

  IF v_bucket_count = 3 THEN
    RAISE NOTICE '✓ All 3 storage buckets exist (disclosures, reports, logos)';
  ELSE
    RAISE EXCEPTION '✗ Expected 3 storage buckets, found %', v_bucket_count;
  END IF;
END $$;

-- ============================================================================
-- 5. Smoke test: Create brand + disclosure + analysis chain, then delete
-- ============================================================================
DO $$
DECLARE
  v_user_id UUID;
  v_brand_id UUID;
  v_disclosure_id UUID;
  v_analysis_id UUID;
  v_test_start TIMESTAMP;
BEGIN
  v_test_start := NOW();
  RAISE NOTICE '--- Starting smoke test at %', v_test_start;

  -- Create test user (using a fixed UUID for testing)
  v_user_id := '00000000-0000-0000-0000-000000000001'::UUID;
  RAISE NOTICE 'Using test user ID: %', v_user_id;

  -- Create test brand
  INSERT INTO brands (
    user_id,
    name,
    company_name,
    representative,
    business_number,
    address,
    phone,
    category,
    price_tier,
    royalty_type,
    royalty_amount,
    standard_size_min,
    standard_size_max,
    standard_staff_count,
    territory_protection_meters,
    contract_period_years
  ) VALUES (
    v_user_id,
    'Test Brand Smoke',
    'Test Company Inc.',
    'Test Representative',
    '123-45-67890',
    '123 Test Street, Seoul',
    '02-1234-5678',
    'Food & Beverage',
    'Premium',
    'Percentage',
    5.5,
    50,
    150,
    10,
    500,
    5
  ) RETURNING id INTO v_brand_id;
  RAISE NOTICE '✓ Created test brand: %', v_brand_id;

  -- Create test disclosure
  INSERT INTO disclosures (
    user_id,
    brand_id,
    file_path,
    file_name,
    file_size,
    mime_type,
    status
  ) VALUES (
    v_user_id,
    v_brand_id,
    'test/disclosure_' || v_brand_id || '.pdf',
    'test_disclosure.pdf',
    1024,
    'application/pdf',
    'pending'
  ) RETURNING id INTO v_disclosure_id;
  RAISE NOTICE '✓ Created test disclosure: %', v_disclosure_id;

  -- Create test disclosure_parsed_data
  INSERT INTO disclosure_parsed_data (
    disclosure_id,
    raw_text,
    parsed_json,
    extraction_status
  ) VALUES (
    v_disclosure_id,
    'Test raw text content',
    '{"test": "data"}'::JSONB,
    'pending'
  );
  RAISE NOTICE '✓ Created test disclosure_parsed_data';

  -- Create test analysis
  INSERT INTO analyses (
    user_id,
    brand_id,
    analysis_type,
    status
  ) VALUES (
    v_user_id,
    v_brand_id,
    'market_analysis',
    'pending'
  ) RETURNING id INTO v_analysis_id;
  RAISE NOTICE '✓ Created test analysis: %', v_analysis_id;

  -- Create test analysis_collected_data
  INSERT INTO analysis_collected_data (
    analysis_id,
    data_type,
    raw_data,
    collection_status
  ) VALUES (
    v_analysis_id,
    'market_data',
    '{"test": "market_data"}'::JSONB,
    'pending'
  );
  RAISE NOTICE '✓ Created test analysis_collected_data';

  -- Create test analysis_reports
  INSERT INTO analysis_reports (
    analysis_id,
    report_type,
    file_path,
    file_name,
    file_size,
    mime_type,
    status
  ) VALUES (
    v_analysis_id,
    'summary',
    'test/report_' || v_analysis_id || '.pdf',
    'test_report.pdf',
    2048,
    'application/pdf',
    'pending'
  );
  RAISE NOTICE '✓ Created test analysis_reports';

  -- Create test public_data_cache
  INSERT INTO public_data_cache (
    cache_key,
    cache_data,
    expires_at
  ) VALUES (
    'test_cache_key_' || v_analysis_id,
    '{"test": "cache"}'::JSONB,
    NOW() + INTERVAL '1 hour'
  );
  RAISE NOTICE '✓ Created test public_data_cache';

  -- Verify all records were created
  RAISE NOTICE '--- Verifying created records';
  PERFORM 1 FROM brands WHERE id = v_brand_id;
  IF FOUND THEN RAISE NOTICE '✓ Brand verified'; END IF;

  PERFORM 1 FROM disclosures WHERE id = v_disclosure_id;
  IF FOUND THEN RAISE NOTICE '✓ Disclosure verified'; END IF;

  PERFORM 1 FROM analyses WHERE id = v_analysis_id;
  IF FOUND THEN RAISE NOTICE '✓ Analysis verified'; END IF;

  -- Cleanup: Delete test records in reverse order (respecting foreign keys)
  RAISE NOTICE '--- Cleaning up test records';

  DELETE FROM analysis_reports WHERE analysis_id = v_analysis_id;
  RAISE NOTICE '✓ Deleted test analysis_reports';

  DELETE FROM analysis_collected_data WHERE analysis_id = v_analysis_id;
  RAISE NOTICE '✓ Deleted test analysis_collected_data';

  DELETE FROM analyses WHERE id = v_analysis_id;
  RAISE NOTICE '✓ Deleted test analysis';

  DELETE FROM disclosure_parsed_data WHERE disclosure_id = v_disclosure_id;
  RAISE NOTICE '✓ Deleted test disclosure_parsed_data';

  DELETE FROM disclosures WHERE id = v_disclosure_id;
  RAISE NOTICE '✓ Deleted test disclosure';

  DELETE FROM brands WHERE id = v_brand_id;
  RAISE NOTICE '✓ Deleted test brand';

  DELETE FROM public_data_cache WHERE cache_key LIKE 'test_cache_key_%';
  RAISE NOTICE '✓ Deleted test public_data_cache';

  RAISE NOTICE '✓ Smoke test completed successfully at %', NOW();
END $$;

-- ============================================================================
-- 6. Test cleanup_expired_public_data_cache() function
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '--- Testing cleanup_expired_public_data_cache() function';
  
  -- Call the cleanup function
  PERFORM cleanup_expired_public_data_cache();
  
  RAISE NOTICE '✓ cleanup_expired_public_data_cache() executed successfully';
END $$;

-- ============================================================================
-- Final Summary
-- ============================================================================
RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║           Migration 005 Validation Complete                    ║
║                                                                ║
║  ✓ All 8 tables exist                                          ║
║  ✓ brands table has all v2.0 columns                           ║
║  ✓ RLS enabled on all new tables                               ║
║  ✓ Storage buckets configured                                  ║
║  ✓ Smoke test passed (create/delete chain)                     ║
║  ✓ cleanup_expired_public_data_cache() function works          ║
║                                                                ║
║  Migration 005 is ready for production!                        ║
╚════════════════════════════════════════════════════════════════╝
';
