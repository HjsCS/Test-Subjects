export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[#fefbf6] flex flex-col items-center justify-center px-5">
      {children}
    </main>
  );
}
