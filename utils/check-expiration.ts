export async function checkIfTokenExpired(lastTokenDate: Date) {
  const now = new Date();
  const diff = now.getTime() - lastTokenDate.getTime();

  return diff > 3600 * 1000;
}
