export default function MembersLoading() {
  return (
    <div className="min-h-screen bg-[#1C1917] animate-pulse">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 bg-[#2D2926] rounded w-56 mb-2" />
            <div className="h-4 bg-[#2D2926] rounded w-40" />
          </div>
        </div>

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-[#2D2926] rounded-full w-28" />
          ))}
        </div>

        {/* Search Bar Skeleton */}
        <div className="h-12 bg-[#2D2926] rounded-xl mb-6" />

        {/* Results count Skeleton */}
        <div className="h-4 bg-[#2D2926] rounded w-48 mb-4" />

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-[#2D2926] rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-14 rounded-full bg-[#3D3936] shrink-0" />
                <div className="flex-1">
                  <div className="h-5 bg-[#3D3936] rounded w-24 mb-2" />
                  <div className="h-4 bg-[#3D3936] rounded w-32" />
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="h-6 bg-[#3D3936] rounded-full w-20" />
                <div className="h-6 bg-[#3D3936] rounded-full w-16" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-[#3D3936] rounded w-full" />
                <div className="h-4 bg-[#3D3936] rounded w-3/4" />
              </div>
              <div className="flex gap-3 text-xs mb-4">
                <div className="h-4 bg-[#3D3936] rounded w-20" />
                <div className="h-4 bg-[#3D3936] rounded w-24" />
              </div>
              <div className="pt-3 border-t border-white/[0.06]">
                <div className="h-10 bg-[#3D3936] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
