alter function public.generate_referral_code() set search_path = public;
revoke execute on function public.approve_due_referral_commissions() from authenticated;
revoke execute on function public.generate_referral_code() from public, anon, authenticated;