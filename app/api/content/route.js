import {json,requireAdmin,supabase} from '../../../lib/server.js';
export const dynamic='force-dynamic';
export async function GET(req){if(!await requireAdmin(req))return json({error:'Нет доступа'},401);const {data,error}=await supabase.from('campaign_content').select('id,message_type,caption,created_at').order('created_at',{ascending:false}).limit(100);if(error)return json({error:'Не удалось загрузить материалы'},500);return json({items:data||[]});}
