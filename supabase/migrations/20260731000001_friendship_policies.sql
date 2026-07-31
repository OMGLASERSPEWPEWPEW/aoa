-- Allow users to delete their own friendships
create policy "Users can delete own friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Replace the old watchlist select policy with one that includes friends
drop policy if exists "Users can read own watchlist" on public.watchlist;
create policy "Users can read own and friend watchlist"
  on public.watchlist for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = user_id)
        or (addressee_id = auth.uid() and requester_id = user_id)
      )
    )
  );
