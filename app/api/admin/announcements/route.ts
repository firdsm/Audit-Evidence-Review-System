import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/auth'

const VALID_PAGES = ['all', 'dashboard', 'audit', 'hasil_penilaian'] as const

/**
 * GET /api/admin/announcements
 * Returns all active announcements (is_active = true), ordered by newest first.
 * All authenticated users can read.
 * Superadmin can pass ?all=true to get all including inactive.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const showAll = request.nextUrl.searchParams.get('all') === 'true'

    let query = supabase
      .from('announcements')
      .select('id, message, is_active, target_pages, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (!showAll) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/announcements
 * Create a new announcement.
 * Superadmin only.
 */
export async function POST(request: NextRequest) {
  const authError = await requireSuperAdminApi()
  if (authError) return authError

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { message, target_pages } = body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 })
    }

    const pages: string[] = Array.isArray(target_pages) ? target_pages : ['all']
    const invalidPages = pages.filter(p => !VALID_PAGES.includes(p as any))
    if (invalidPages.length > 0) {
      return NextResponse.json(
        { error: `Halaman tidak valid: ${invalidPages.join(', ')}` },
        { status: 400 }
      )
    }
    if (pages.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu halaman target' }, { status: 400 })
    }

    // Lookup created_by UUID from auditors table via email
    const { data: auditor } = await supabase
      .from('auditors')
      .select('id')
      .eq('email', user!.email!)
      .maybeSingle()

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        message: message.trim(),
        target_pages: pages,
        is_active: true,
        created_by: auditor?.id ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/announcements
 * Update message, target_pages, or toggle is_active.
 * Body: { id, message?, target_pages?, is_active? }
 * Superadmin only.
 */
export async function PATCH(request: NextRequest) {
  const authError = await requireSuperAdminApi()
  if (authError) return authError

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, message, target_pages, is_active } = body

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 })

    const updates: Record<string, any> = {}

    if (message !== undefined) {
      if (typeof message !== 'string' || message.trim() === '') {
        return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 })
      }
      updates.message = message.trim()
    }

    if (target_pages !== undefined) {
      const pages: string[] = Array.isArray(target_pages) ? target_pages : ['all']
      const invalidPages = pages.filter(p => !VALID_PAGES.includes(p as any))
      if (invalidPages.length > 0) {
        return NextResponse.json(
          { error: `Halaman tidak valid: ${invalidPages.join(', ')}` },
          { status: 400 }
        )
      }
      if (pages.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu halaman target' }, { status: 400 })
      }
      updates.target_pages = pages
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/announcements
 * Delete an announcement by id.
 * Body: { id }
 * Superadmin only.
 */
export async function DELETE(request: NextRequest) {
  const authError = await requireSuperAdminApi()
  if (authError) return authError

  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 })

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
