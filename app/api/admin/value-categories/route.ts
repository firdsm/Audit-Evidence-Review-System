import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

// Helper validator to check overlap between range lists
function checkOverlap(
  min: number,
  max: number,
  categories: { id?: string; min_score: number; max_score: number }[],
  ignoreId?: string
): boolean {
  for (const cat of categories) {
    if (ignoreId && cat.id === ignoreId) continue
    // Overlap condition: min1 < max2 AND max1 > min2
    if (min < cat.max_score && max > cat.min_score) {
      return true
    }
  }
  return false
}

/**
 * GET /api/admin/value-categories
 * Returns all categories ordered by min_score ascending.
 * All authenticated users can read (for badges on Rankings page).
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: categories, error } = await supabase
      .from('value_categories')
      .select('*')
      .order('min_score', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(categories || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/value-categories
 * Creates or updates a value category (Superadmin only).
 * Body: { id?, kode, makna, min_score, max_score, color }
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperAdminApi()
    if (guard) return guard

    const supabase = await createClient()
    const body = await request.json()
    const { id, kode, makna, min_score, max_score, color } = body

    if (!kode || !kode.trim()) {
      return NextResponse.json({ error: 'Kode kategori diperlukan (contoh: "A", "A-", "B")' }, { status: 400 })
    }
    if (!makna || !makna.trim()) {
      return NextResponse.json({ error: 'Makna/nama kategori diperlukan (contoh: "Pelayanan Prima")' }, { status: 400 })
    }

    const minNum = parseFloat(min_score)
    const maxNum = parseFloat(max_score)

    if (isNaN(minNum) || isNaN(maxNum) || minNum < 0 || maxNum > 5) {
      return NextResponse.json({ error: 'Rentang nilai harus berada di antara 0.00 dan 5.00' }, { status: 400 })
    }

    if (minNum >= maxNum) {
      return NextResponse.json({ error: 'Batas bawah (Min) harus lebih kecil dari batas atas (Max)' }, { status: 400 })
    }

    // Fetch existing entries to validate overlaps
    const { data: existing } = await supabase
      .from('value_categories')
      .select('id, min_score, max_score')

    const categoryList = (existing || []).map((c: any) => ({
      id: c.id,
      min_score: parseFloat(c.min_score),
      max_score: parseFloat(c.max_score),
    }))

    if (checkOverlap(minNum, maxNum, categoryList, id)) {
      return NextResponse.json(
        { error: 'Rentang nilai bentrok/overlap dengan kategori yang sudah ada' },
        { status: 400 }
      )
    }

    const payload = {
      kode: kode.trim(),
      makna: makna.trim(),
      min_score: minNum,
      max_score: maxNum,
      color: color || 'zinc',
    }

    let saveError
    if (id) {
      const { error } = await supabase
        .from('value_categories')
        .update(payload)
        .eq('id', id)
      saveError = error
    } else {
      const { error } = await supabase
        .from('value_categories')
        .insert(payload)
      saveError = error
    }

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/value-categories?id=<uuid>
 * Deletes a value category (Superadmin only).
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireSuperAdminApi()
    if (guard) return guard

    const supabase = await createClient()
    const id = request.nextUrl.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Parameter id diperlukan' }, { status: 400 })
    }

    const { error } = await supabase.from('value_categories').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
