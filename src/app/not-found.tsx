import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1C1917] flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <p className="text-xl text-[#A8A29E] mb-8">Page not found</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium rounded-xl transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
