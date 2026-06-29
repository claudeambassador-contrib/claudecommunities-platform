"use client";

import { CheckCircle, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useCallback, useState } from "react";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface KnowledgeCheckProps {
  questions: Question[];
}

export default function KnowledgeCheck({ questions }: KnowledgeCheckProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answers, setAnswers] = useState<(boolean | null)[]>(
    new Array(questions.length).fill(null),
  );
  const [showResults, setShowResults] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; color: string; angle: number; speed: number }[]
  >([]);

  const spawnParticles = useCallback(() => {
    const newParticles = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50,
      color: ["#D4836A", "#E8A090", "#FFD700", "#4ADE80", "#60A5FA", "#F472B6"][
        Math.floor(Math.random() * 6)
      ],
      angle: (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.5,
      speed: 2 + Math.random() * 3,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1500);
  }, []);

  const handleAnswer = (optionIdx: number) => {
    if (hasAnswered) return;
    setSelectedOption(optionIdx);
    setHasAnswered(true);
    const isCorrect = optionIdx === questions[currentQ].correctIndex;
    const newAnswers = [...answers];
    newAnswers[currentQ] = isCorrect;
    setAnswers(newAnswers);
    if (isCorrect) {
      spawnParticles();
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      setSelectedOption(null);
      setHasAnswered(false);
    } else {
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelectedOption(null);
    setHasAnswered(false);
    setAnswers(new Array(questions.length).fill(null));
    setShowResults(false);
    setParticles([]);
  };

  const correctCount = answers.filter((a) => a === true).length;
  const allCorrect = correctCount === questions.length;

  if (showResults) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <style>{`
          @keyframes kc-celebrate {
            0% { transform: scale(0.8) rotate(-5deg); opacity: 0; }
            50% { transform: scale(1.05) rotate(2deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
          }
          @keyframes kc-golden-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.2); }
            50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.4); }
          }
          @keyframes kc-score-count {
            from { transform: scale(0); }
            to { transform: scale(1); }
          }
        `}</style>
        <div
          className={`rounded-xl border p-8 text-center ${
            allCorrect ? "bg-[#2D2926] border-yellow-500/30" : "bg-[#2D2926] border-white/[0.06]"
          }`}
          style={{
            animation: allCorrect
              ? "kc-celebrate 0.6s ease-out, kc-golden-glow 2s ease-in-out infinite 0.6s"
              : "kc-celebrate 0.6s ease-out",
          }}
        >
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              allCorrect ? "bg-yellow-500/20" : "bg-[#D4836A]/20"
            }`}
            style={{ animation: "kc-score-count 0.4s ease-out 0.3s both" }}
          >
            <Trophy size={28} className={allCorrect ? "text-yellow-500" : "text-[#D4836A]"} />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">
            {allCorrect
              ? "Perfect Score!"
              : correctCount > questions.length / 2
                ? "Great Job!"
                : "Keep Learning!"}
          </h3>
          <p className="text-[#A8A29E] mb-4">
            You got{" "}
            <span className="text-[#D4836A] font-semibold">
              {correctCount}/{questions.length}
            </span>{" "}
            questions correct
          </p>

          {/* Score bar */}
          <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden mb-6 max-w-xs mx-auto">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${(correctCount / questions.length) * 100}%`,
                background: allCorrect
                  ? "linear-gradient(90deg, #FFD700, #FFA500)"
                  : "linear-gradient(90deg, #D4836A, #E8A090)",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4836A] text-white text-sm font-medium hover:bg-[#C07560] transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentQ];

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <style>{`
        @keyframes kc-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes kc-correct-flash {
          0% { background-color: rgba(74, 222, 128, 0.3); }
          100% { background-color: transparent; }
        }
        @keyframes kc-particle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0);
            opacity: 0;
          }
        }
        @keyframes kc-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes kc-option-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .kc-shake {
          animation: kc-shake 0.4s ease-in-out;
        }
        .kc-correct-flash {
          animation: kc-correct-flash 0.6s ease-out;
        }
      `}</style>

      {/* Confetti particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute w-2 h-2 rounded-full pointer-events-none z-10"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            ["--tx" as string]: `${Math.cos(p.angle) * p.speed * 40}px`,
            ["--ty" as string]: `${Math.sin(p.angle) * p.speed * 40 - 60}px`,
            animation: "kc-particle 1.2s ease-out forwards",
          }}
        />
      ))}

      <div
        className="rounded-xl bg-[#2D2926] border border-white/[0.06] overflow-hidden"
        style={{ animation: "kc-slide-in 0.4s ease-out" }}
        key={currentQ}
      >
        {/* Progress dots */}
        <div className="px-5 pt-4 flex items-center gap-2">
          {questions.map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: progress dots over a fixed question list that never reorders or changes length
              key={i}
              className={`
                h-2 rounded-full transition-all duration-300
                ${i === currentQ ? "w-6" : "w-2"}
                ${
                  answers[i] === true
                    ? "bg-green-500"
                    : answers[i] === false
                      ? "bg-red-400"
                      : i === currentQ
                        ? "bg-[#D4836A]"
                        : "bg-white/[0.1]"
                }
              `}
            />
          ))}
          <span className="ml-auto text-xs text-[#78716C] font-mono">
            {currentQ + 1}/{questions.length}
          </span>
        </div>

        {/* Question */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-white font-semibold leading-snug">{question.question}</h3>
        </div>

        {/* Options */}
        <div className="px-5 pb-4 space-y-2">
          {question.options.map((option, i) => {
            const isSelected = selectedOption === i;
            const isCorrect = i === question.correctIndex;
            const showCorrect = hasAnswered && isCorrect;
            const showWrong = hasAnswered && isSelected && !isCorrect;

            return (
              <button
                type="button"
                key={option}
                onClick={() => handleAnswer(i)}
                disabled={hasAnswered}
                className={`
                  w-full text-left px-4 py-3 rounded-lg text-sm transition-all duration-200
                  flex items-center gap-3 cursor-pointer
                  ${
                    showCorrect
                      ? "bg-green-500/15 border border-green-500/30 text-green-300 kc-correct-flash"
                      : showWrong
                        ? "bg-red-400/15 border border-red-400/30 text-red-300 kc-shake"
                        : isSelected
                          ? "bg-[#D4836A]/15 border border-[#D4836A]/30 text-[#E7E5E4]"
                          : "bg-white/[0.03] border border-white/[0.06] text-[#A8A29E] hover:bg-white/[0.06] hover:text-[#E7E5E4] hover:border-white/[0.1]"
                  }
                  ${hasAnswered ? "cursor-default" : ""}
                `}
                style={{
                  animation: `kc-option-in 0.3s ease-out ${i * 60}ms both`,
                }}
              >
                {/* Radio indicator */}
                <span
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-all duration-200
                    ${
                      showCorrect
                        ? "border-green-500 bg-green-500"
                        : showWrong
                          ? "border-red-400 bg-red-400"
                          : isSelected
                            ? "border-[#D4836A] bg-[#D4836A]"
                            : "border-[#78716C]/40"
                    }
                  `}
                >
                  {showCorrect && <CheckCircle size={12} className="text-white" />}
                  {showWrong && <XCircle size={12} className="text-white" />}
                  {isSelected && !hasAnswered && <span className="w-2 h-2 rounded-full bg-white" />}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Explanation + Next */}
        {hasAnswered && (
          <div className="px-5 pb-5" style={{ animation: "kc-slide-in 0.3s ease-out" }}>
            <div
              className={`rounded-lg px-4 py-3 mb-3 text-sm ${
                selectedOption === question.correctIndex
                  ? "bg-green-500/10 border border-green-500/20 text-green-300/90"
                  : "bg-white/[0.03] border border-white/[0.06] text-[#A8A29E]"
              }`}
            >
              {question.explanation}
            </div>
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-2.5 rounded-lg bg-[#D4836A] text-white text-sm font-medium hover:bg-[#C07560] transition-colors cursor-pointer"
            >
              {currentQ < questions.length - 1 ? "Next Question" : "See Results"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
