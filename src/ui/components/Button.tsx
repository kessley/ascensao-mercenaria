import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 border-blue-400",
  danger: "bg-red-700 hover:bg-red-600 border-red-500",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`rounded border px-4 py-2 font-semibold text-white transition-colors disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
