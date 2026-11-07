import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { api } from '../lib/api';

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.signOut,
    // Signing out always lands on login, even if the session was already gone.
    onSettled: () => {
      // No cache belongs to the next session: drop the previous user's data
      // before the redirect so the login screen cannot read it back.
      queryClient.clear();
      navigate({ to: '/login' });
    },
  });
}
