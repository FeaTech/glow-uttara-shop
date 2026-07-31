revoke execute on function public.my_referral_counts() from public, anon;
revoke execute on function public.my_referral_history() from public, anon;
grant execute on function public.my_referral_counts() to authenticated;
grant execute on function public.my_referral_history() to authenticated;