import { Spinner } from "@/components/ui/spinner"

interface LoadingStateProps {
  label?: string
}

export const LoadingState = ({ label = "Cargando..." }: LoadingStateProps) => (
  <div className="text-muted-foreground flex h-full min-h-48 items-center justify-center gap-3 text-sm">
    <Spinner aria-label={label} />
    {label}
  </div>
)
