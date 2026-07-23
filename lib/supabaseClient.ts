import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yjeyijphsghrfssxefqf.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_InkKOMwPNGrcL2KHhMIeag_BnZShjBN";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
