import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vqglmkwpqstljxilpauh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KggKpO67JeTutir7W_w8XQ_VxUVf_Gx';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

export async function testDatabaseConnection() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price')
    .limit(5);

  if (error) {
    console.error('Supabase connection failed:', error.message);
    return { success: false, error: error.message };
  }

  console.log('Supabase connection successful!', data);
  return { success: true, products: data };
}