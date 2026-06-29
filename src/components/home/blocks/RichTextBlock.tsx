import type { RichTextBlock as RichTextBlockData } from "@/lib/cms/blocks";

/** Generic "add your own content" block. Body is plain text only (rendered via
 * `whitespace-pre-line`) — never raw HTML. */
export default function RichTextBlock({ block }: { block: RichTextBlockData }) {
  return (
    <section className="bg-[#1C1917] px-6 py-16">
      <div className="max-w-[800px] mx-auto">
        {block.heading && (
          <h2 className="text-3xl md:text-4xl font-semibold text-center mb-8">{block.heading}</h2>
        )}
        <p className="text-[#A8A29E] text-lg leading-relaxed whitespace-pre-line">{block.body}</p>
      </div>
    </section>
  );
}
