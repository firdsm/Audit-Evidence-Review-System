import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuditorRole } from '@/lib/auth'

/**
 * POST /api/scores/f03
 *
 * Request Types:
 * 1. Single Upsert:
 *    { type: 'single', institutionId: '<uuid>', score: 4.2 }
 *
 * 2. Bulk Upsert:
 *    { type: 'bulk', score: 3.5, category: 'ALL' | '<category>', exceptions: ['<uuid1>', '<uuid2>'] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate and enforce superadmin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await getAuditorRole()
    if (role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    // Get current auditor ID to log in updated_by
    const { data: auditor } = await supabase
      .from('auditors')
      .select('id')
      .eq('email', user.email || '')
      .single()

    const body = await request.json()
    const { type, score } = body

    if (typeof score !== 'number' || score < 1.0 || score > 5.0) {
      return NextResponse.json({ error: 'Nilai F-03 harus berupa angka antara 1.0 dan 5.0' }, { status: 400 })
    }

    if (type === 'single') {
      const { institutionId } = body
      if (!institutionId) {
        return NextResponse.json({ error: 'Parameter institutionId diperlukan' }, { status: 400 })
      }

      const { error } = await supabase
        .from('f03_scores')
        .upsert({
          institution_id: institutionId,
          score,
          updated_by: auditor?.id || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'institution_id' })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else if (type === 'bulk') {
      const { category, exceptions = [] } = body
      const exceptionSet = new Set(exceptions)

      // Query target institutions
      let query = supabase.from('institutions').select('id')
      if (category && category !== 'ALL') {
        query = query.eq('category', category)
      }

      const { data: targets, error: targetErr } = await query
      if (targetErr) {
        return NextResponse.json({ error: targetErr.message }, { status: 500 })
      }

      const finalTargets = (targets || []).filter((t) => !exceptionSet.has(t.id))
      if (finalTargets.length === 0) {
        return NextResponse.json({ success: true, message: 'Tidak ada instansi yang diperbarui' })
      }

      const upsertPayloads = finalTargets.map((t) => ({
        institution_id: t.id,
        score,
        updated_by: auditor?.id || null,
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await supabase
        .from('f03_scores')
        .upsert(upsertPayloads, { onConflict: 'institution_id' })

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: finalTargets.length })
    } else {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[scores/f03] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
