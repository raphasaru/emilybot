'use client';

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-200">
      Sair
    </button>
  );
}
