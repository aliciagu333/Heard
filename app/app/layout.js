import NavBar from '@/components/NavBar';

export default function AppLayout({ children }) {
  return (
    <>
      <main className="flex-1 pb-24 pt-4">
        {children}
      </main>
      <NavBar />
    </>
  );
}
