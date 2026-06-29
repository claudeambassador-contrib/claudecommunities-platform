export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#1C1917] animate-pulse">
      {/* Cover Image Skeleton */}
      <div className="relative h-32 md:h-40 bg-[#2D2926]" />

      <div className="max-w-2xl mx-auto px-6">
        {/* Profile Card Skeleton */}
        <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] mb-8 -mt-12 relative">
          <div className="p-6 pt-16">
            {/* Avatar Skeleton */}
            <div className="absolute -top-10 left-6">
              <div className="w-20 h-20 rounded-full bg-[#3D3936] ring-4 ring-[#2D2926]" />
            </div>

            {/* Name Skeleton */}
            <div className="h-8 bg-[#3D3936] rounded w-48 mb-4" />

            {/* Tagline Skeleton */}
            <div className="h-4 bg-[#3D3936] rounded w-64 mb-4" />

            {/* Level Badge Skeleton */}
            <div className="flex gap-2 mb-4">
              <div className="h-6 bg-[#3D3936] rounded-full w-24" />
              <div className="h-6 bg-[#3D3936] rounded-full w-20" />
            </div>

            {/* Bio Skeleton */}
            <div className="space-y-2 mt-4 pt-4 border-t border-white/[0.06]">
              <div className="h-4 bg-[#3D3936] rounded w-full" />
              <div className="h-4 bg-[#3D3936] rounded w-3/4" />
            </div>

            {/* Location/Date Skeleton */}
            <div className="flex gap-4 mt-4">
              <div className="h-4 bg-[#3D3936] rounded w-24" />
              <div className="h-4 bg-[#3D3936] rounded w-32" />
            </div>

            {/* Stats Skeleton */}
            <div className="flex gap-6 mt-4 pt-4 border-t border-white/[0.06]">
              <div className="text-center">
                <div className="h-6 bg-[#3D3936] rounded w-8 mx-auto mb-1" />
                <div className="h-4 bg-[#3D3936] rounded w-12" />
              </div>
              <div className="text-center">
                <div className="h-6 bg-[#3D3936] rounded w-8 mx-auto mb-1" />
                <div className="h-4 bg-[#3D3936] rounded w-16" />
              </div>
            </div>
          </div>
        </div>

        {/* Posts Section Skeleton */}
        <div className="h-6 bg-[#3D3936] rounded w-32 mb-4" />

        <div className="space-y-4 pb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#2D2926] rounded-2xl p-6 border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#3D3936]" />
                <div>
                  <div className="h-4 bg-[#3D3936] rounded w-24 mb-1" />
                  <div className="h-3 bg-[#3D3936] rounded w-16" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-[#3D3936] rounded w-full" />
                <div className="h-4 bg-[#3D3936] rounded w-5/6" />
                <div className="h-4 bg-[#3D3936] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
