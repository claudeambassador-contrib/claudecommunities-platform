import type { ChangeEvent, MouseEvent, ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  emptySlide,
  parseSlideDeck,
  type SlideDraft,
  type SlideLayout,
  serializeSlideDeck,
} from "@/modules/slides/slideDraft";

export function SlideCanvas({
  initialJson,
  onChange,
}: {
  initialJson: string;
  onChange: (json: string) => void;
}): ReactElement {
  const initial = useMemo(() => {
    try {
      return parseSlideDeck(JSON.parse(initialJson) as unknown);
    } catch {
      return parseSlideDeck(null);
    }
  }, [initialJson]);
  const [deck, setDeck] = useState(initial);
  const [selected, setSelected] = useState(0);

  const commit = useCallback(
    (next: typeof deck) => {
      setDeck(next);
      onChange(JSON.stringify(serializeSlideDeck(next), null, 2));
    },
    [onChange],
  );

  const slide = deck.slides[selected] ?? deck.slides[0];

  const updateSlide = useCallback(
    (patch: Partial<SlideDraft>) => {
      if (!slide) {
        return;
      }
      commit({
        slides: deck.slides.map((item, index) =>
          index === selected ? { ...item, ...patch } : item,
        ),
      });
    },
    [commit, deck.slides, selected, slide],
  );

  const addSlide = useCallback(() => {
    const next = emptySlide(`slide_${deck.slides.length + 1}`);
    commit({ slides: [...deck.slides, next] });
    setSelected(deck.slides.length);
  }, [commit, deck.slides]);

  const removeSlide = useCallback(() => {
    if (deck.slides.length <= 1) {
      return;
    }
    const slides = deck.slides.filter((_, index) => index !== selected);
    commit({ slides });
    setSelected(Math.max(0, selected - 1));
  }, [commit, deck.slides, selected]);

  const handleSelect = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setSelected(Number(event.currentTarget.dataset.index));
  }, []);

  const handleField = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = event.currentTarget;
      if (name === "layout") {
        updateSlide({ layout: value as SlideLayout });
        return;
      }
      if (name === "title" || name === "speaker" || name === "body") {
        updateSlide({ [name]: value });
      }
    },
    [updateSlide],
  );

  if (!slide) {
    return <p className="muted">No slides.</p>;
  }

  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: "wrap" }}>
        {deck.slides.map((item, index) => (
          <button
            className={index === selected ? "btn btn-primary" : "btn"}
            data-index={index}
            key={item.id}
            onClick={handleSelect}
            type="button"
          >
            {index + 1}. {item.title || "Untitled"}
          </button>
        ))}
        <button className="btn" onClick={addSlide} type="button">
          Add slide
        </button>
        <button className="btn" onClick={removeSlide} type="button">
          Remove
        </button>
      </div>
      <div
        className="card stack"
        style={{
          aspectRatio: "16 / 9",
          background: slide.layout === "minimal" ? "#faf9f6" : "#1c1917",
          color: slide.layout === "minimal" ? "#1c1917" : "#faf9f6",
          justifyContent: slide.layout === "centered" ? "center" : "flex-end",
          minHeight: 220,
        }}
      >
        <strong style={{ fontSize: "1.5rem" }}>{slide.title || "Untitled slide"}</strong>
        {slide.speaker ? <div>{slide.speaker}</div> : null}
        {slide.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{slide.body}</p> : null}
      </div>
      <div className="card stack">
        <input
          className="field"
          name="title"
          onChange={handleField}
          placeholder="Title"
          value={slide.title}
        />
        <input
          className="field"
          name="speaker"
          onChange={handleField}
          placeholder="Speaker"
          value={slide.speaker}
        />
        <textarea
          className="field"
          name="body"
          onChange={handleField}
          placeholder="Talk / body"
          rows={4}
          style={{ width: "100%" }}
          value={slide.body}
        />
        <select className="field" name="layout" onChange={handleField} value={slide.layout}>
          <option value="classic">Classic</option>
          <option value="centered">Centered</option>
          <option value="minimal">Minimal</option>
        </select>
      </div>
    </div>
  );
}
