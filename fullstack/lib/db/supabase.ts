import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Gunakan Service Role untuk Backend bypass RLS

// Client khusus untuk digunakan di route handlers (API) agar bisa bypass RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
