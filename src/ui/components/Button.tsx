import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "gold" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** O tom da peça de pixel de cada variante (G5, parte 2). */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "btn-blue",
  danger: "btn-red",
  gold: "btn-gold",
  quiet: "btn-wood",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn-pixel px-3 py-1 font-pixel text-xs font-bold disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
