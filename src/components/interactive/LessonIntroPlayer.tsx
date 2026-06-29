"use client";

import { Player } from "@remotion/player";
import { LessonIntro } from "@/remotion/LessonIntro";

interface LessonIntroPlayerProps {
  lessonNumber: number;
  lessonTitle: string;
  lessonDuration: string;
  courseTitle: string;
}

export default function LessonIntroPlayer({
  lessonNumber,
  lessonTitle,
  lessonDuration,
  courseTitle,
}: LessonIntroPlayerProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] my-6">
      <Player
        component={LessonIntro}
        inputProps={{ lessonNumber, lessonTitle, lessonDuration, courseTitle }}
        durationInFrames={120}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{ width: "100%", aspectRatio: "16/9" }}
        autoPlay
        loop={false}
        controls={false}
      />
    </div>
  );
}
