import Link from "next/link";
import { PLATFORM } from "@/lib/platform";

export default function PlatformNotFound() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <p className="mt-3 text-[#A8A29E]">That page doesn’t exist on {PLATFORM.name}.</p>
      <Link
        href="/"
        className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-[#D4836A] hover:bg-[#c4775f] text-white font-medium transition-colors"
      >
        Browse communities
      </Link>
    </div>
  );
}
