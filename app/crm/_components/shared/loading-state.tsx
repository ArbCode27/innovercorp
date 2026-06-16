interface LoadingStateProps {
  label?: string;
}

export const LoadingState = ({ label = "Cargando..." }: LoadingStateProps) => (
  <div className="flex h-full min-h-48 items-center justify-center gap-3 text-sm text-slate-400">
    <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-blue-400" />
    {label}
  </div>
);
