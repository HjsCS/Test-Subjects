export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main
      className="bg-[#fefbf6] flex flex-col items-center justify-center px-5"
      style={{ minHeight: "100dvh" }}
    >
      {children}
    </main>
  );
}
