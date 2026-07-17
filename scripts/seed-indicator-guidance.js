const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1'); // strip outer quotes if any
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = val;
      } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseServiceRoleKey = val;
      }
    }
  }
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in env or .env.local');
  process.exit(1);
}

// 2. Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 3. Read indicator-guidance.json
const jsonPath = path.join(__dirname, '..', 'indicator-guidance.json');
if (!fs.existsSync(jsonPath)) {
  console.error(`Error: File not found at ${jsonPath}. Please create this file first.`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

async function seed() {
  console.log(`Starting migration seed for ${data.length} indicator(s)...`);

  for (const entry of data) {
    const { indicator_code, scale, required_documents } = entry;
    if (!indicator_code) {
      console.warn('Skipping entry with missing indicator_code:', entry);
      continue;
    }

    // Find the indicator first
    const { data: indicator, error: fetchError } = await supabase
      .from('indicators')
      .select('id, code')
      .eq('code', indicator_code)
      .maybeSingle();

    if (fetchError) {
      console.error(`[DB Error] Failed to fetch indicator ${indicator_code}:`, fetchError.message);
      continue;
    }

    if (!indicator) {
      console.error(`[Warning] Indicator code not found in DB: ${indicator_code}`);
      continue;
    }

        // Build update payload dynamically
    const updateData = {};
    if (scale !== undefined) {
      updateData.scoring_scale = scale;
    }
    if (required_documents !== undefined) {
      updateData.required_documents = required_documents;
    }
    if (entry.explanation !== undefined) {
      updateData.explanation = entry.explanation;
    }

    // If nothing to update, skip
    if (Object.keys(updateData).length === 0) {
      console.log(`[Skipped] No fields to update for indicator: ${indicator_code}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('indicators')
      .update(updateData)
      .eq('id', indicator.id);

    if (updateError) {
      console.error(`[Error] Failed to update indicator ${indicator_code}:`, updateError.message);
    } else {
      console.log(`[Success] Updated indicator: ${indicator_code} (${Object.keys(updateData).join(', ')})`);
    }
  }

  console.log('Seed process completed.');
}

seed().catch((err) => {
  console.error('Unhandled seed error:', err);
  process.exit(1);
});
