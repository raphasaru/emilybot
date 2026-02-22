import MascotAvatar from './MascotAvatar';

export default function Footer() {
  return (
    <footer className="border-t border-surface-border py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-surface overflow-hidden flex items-center justify-center">
            <MascotAvatar className="w-10 h-10 -mb-0.5" />
          </div>
          <span className="font-display font-bold text-lg">EmilyBot</span>
          <span className="text-text-subtle text-sm">&copy; 2026</span>
        </div>
        <p className="text-text-subtle text-sm">
          Conteúdo no piloto automático.
        </p>
      </div>
    </footer>
  );
}
