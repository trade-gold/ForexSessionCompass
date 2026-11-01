/*
# Remove anonymous read access to academy accounts

1. Modified Tables
- `academies`: anonymous visitors no longer have any privilege on this table.

2. Security
- Revokes SELECT from the `anon` role. Academy rows contain customer emails and contact details and must only be readable by their owner or an administrator (both through signed-in policies).

3. Important Notes
- Signed-in access is unchanged: owners read their own row, administrators read all rows.
*/

REVOKE ALL ON public.academies FROM anon;
