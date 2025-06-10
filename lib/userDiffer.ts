export function userDiffer(oldUsers: string[], newUsers: string[]): {newUsers: string[], removedUsers: string[]} {
  const oldSet = new Set(oldUsers);
  const newSet = new Set(newUsers);

  // Find users that are in the old set but not in the new set
  const removedUsers = oldUsers.filter(user => !newSet.has(user));

  // Find users that are in the new set but not in the old set
  const addedUsers = newUsers.filter(user => !oldSet.has(user));

  // Combine both arrays to get the final difference
  return {
    newUsers: addedUsers,
    removedUsers: removedUsers
  }
}