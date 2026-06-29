export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-[#1C1917] animate-pulse">
      {/* Banner Skeleton */}
      <div className="bg-gradient-to-br from-[#2D2926] via-[#3D3430] to-[#2D2926] border-b border-white/[0.06]">
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col items-center text-center gap-6">
            <div>
              <div className="h-10 bg-[#3D3936] rounded w-72 mx-auto mb-3" />
              <div className="h-4 bg-[#3D3936] rounded w-96 mx-auto" />
            </div>
            <div className="flex items-center justify-center gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-[#3D3936] rounded w-12 mx-auto mb-1" />
                  <div className="h-3 bg-[#3D3936] rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="xl:mr-[300px]">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Composer Skeleton */}
          <div className="bg-[#2D2926] rounded-2xl p-4 border border-white/[0.06] mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#3D3936]" />
              <div className="flex-1 h-10 bg-[#3D3936] rounded-xl" />
            </div>
          </div>

          {/* Post Skeletons */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
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
                <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="h-8 bg-[#3D3936] rounded w-16" />
                  <div className="h-8 bg-[#3D3936] rounded w-16" />
                  <div className="h-8 bg-[#3D3936] rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
