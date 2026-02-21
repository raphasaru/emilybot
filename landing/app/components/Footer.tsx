export default function Footer() {
  return (
    <footer className="border-t border-brand-border py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-lg">EmilyBot</span>
          <span className="text-brand-muted text-sm">&copy; 2026</span>
        </div>
        <p className="text-brand-muted text-sm">
          Conteúdo no piloto automático.
        </p>
      </div>
    </footer>
  );
}
