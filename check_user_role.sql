-- Check current users and their roles
SELECT 
  u.id, 
  u.email, 
  ur.role 
FROM auth.users u 
LEFT JOIN public.user_roles ur ON u.id = ur.user_id 
ORDER BY u.created_at DESC 
LIMIT 5;
