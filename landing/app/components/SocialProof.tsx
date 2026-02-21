export default function SocialProof() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-brand-border bg-brand-card/60">
          <div className="flex -space-x-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-brand-dark bg-brand-purple/20 flex items-center justify-center"
              >
                <span className="text-xs text-brand-purple font-semibold">
                  {["R", "M", "A", "J"][i]}
                </span>
              </div>
            ))}
          </div>
          <span className="text-brand-muted text-sm">
            Usado por criadores no beta fechado
          </span>
        </div>
      </div>
    </section>
  );
}
