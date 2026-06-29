"use client";

export function PostCardSkeleton() {
  return (
    <div className="bg-[#2D2926] rounded-2xl p-6 border border-white/[0.06] animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-4">
        <div className="w-11 h-11 rounded-full bg-white/[0.1]" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-white/[0.1] rounded mb-2" />
          <div className="h-3 w-32 bg-white/[0.08] rounded" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="h-5 w-3/4 bg-white/[0.1] rounded" />
        <div className="h-4 w-full bg-white/[0.08] rounded" />
        <div className="h-4 w-2/3 bg-white/[0.08] rounded" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-5 pt-4 mt-4 border-t border-white/[0.06]">
        <div className="h-4 w-12 bg-white/[0.08] rounded" />
        <div className="h-4 w-12 bg-white/[0.08] rounded" />
      </div>
    </div>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="bg-[#2D2926] rounded-xl p-4 border border-white/[0.06] animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/[0.1]" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-white/[0.1] rounded mb-2" />
          <div className="h-3 w-32 bg-white/[0.08] rounded" />
        </div>
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-[#2D2926] rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse">
      <div className="flex">
        <div className="w-20 bg-white/[0.05] py-6" />
        <div className="flex-1 p-4 space-y-2">
          <div className="h-4 w-3/4 bg-white/[0.1] rounded" />
          <div className="h-3 w-1/2 bg-white/[0.08] rounded" />
          <div className="h-3 w-2/3 bg-white/[0.08] rounded" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  );
}

export function ComposerSkeleton() {
  return (
    <div className="bg-[#2D2926] rounded-2xl p-5 border border-white/[0.06] mb-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-white/[0.1]" />
        <div className="flex-1">
          <div className="h-20 bg-white/[0.05] rounded-xl mb-3" />
          <div className="flex justify-between">
            <div className="h-9 w-32 bg-white/[0.08] rounded-lg" />
            <div className="h-9 w-20 bg-white/[0.08] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
